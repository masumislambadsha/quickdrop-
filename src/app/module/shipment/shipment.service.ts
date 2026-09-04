import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client.js";

import { prisma } from "../../lib/prisma.js";

import { AppError } from "../../utils/AppError.js";

import {
	buildWhere,
	calculatePagination,
	parsePageParams,
} from "../../utils/pagination.js";

import {
	calculateShippingCost,
	generateTrackingNumber,
	getNextStatuses,
} from "../../utils/shipmentUtils.js";

import type {
	ICreateShipmentRequest,
	IListShipmentsQuery,
	IMyShipmentsQuery,
	IUpdateShipmentRequest,
} from "./shipment.interface.js";

async function getCustomerId(userId: string): Promise<string> {
	const customer = await prisma.customer.findUnique({
		where: { userId },
		select: { id: true },
	});

	if (!customer) {
		throw new AppError(httpStatus.NOT_FOUND, "Customer profile not found.");
	}

	return customer.id;
}

async function createShipment(userId: string, payload: ICreateShipmentRequest) {
	const customerId = await getCustomerId(userId);

	const cost = calculateShippingCost({
		distanceKm: payload.distanceKm,
		weightKg: payload.weightKg,
		pricingTier: payload.pricingTier,
		packageType: payload.packageType,
	});

	const trackingNumber = generateTrackingNumber();

	const shipment = await prisma.$transaction(async (tx) => {
		const created = await tx.shipment.create({
			data: {
				trackingNumber,
				customerId,
				senderName: payload.senderName,
				senderPhone: payload.senderPhone,
				recipientName: payload.recipientName,
				recipientPhone: payload.recipientPhone,
				origin: payload.origin,
				destination: payload.destination,
				distanceKm: payload.distanceKm,
				weightKg: payload.weightKg,
				packageType: payload.packageType,
				declaredValue: payload.declaredValue ?? 0,
				pricingTier: payload.pricingTier,
				cost,
				notes: payload.notes,
				status: "REQUESTED",
			},
		});

		await tx.trackingEvent.create({
			data: {
				shipmentId: created.id,
				status: "REQUESTED",
				location: payload.origin,
				description: "Shipment request received.",
			},
		});

		await tx.auditLog.create({
			data: {
				actorId: userId,
				actorRole: "CUSTOMER",
				action: "SHIPMENT_CREATED",
				resourceType: "Shipment",
				resourceId: created.id,
			},
		});

		return created;
	});

	return shipment;
}

async function getShipments(query: IListShipmentsQuery) {
	const { page, limit, skip } = parsePageParams(query.page, query.limit);

	const where = buildWhere({
		search: query.search,
		searchFields: ["trackingNumber", "recipientName", "destination", "origin"],
		status: query.status,
	});

	const [shipments, total] = await prisma.$transaction([
		prisma.shipment.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				customer: { select: { name: true, email: true } },
				delivery: { select: { id: true, courierId: true, status: true } },
			},
		}),
		prisma.shipment.count({ where }),
	]);

	return {
		data: shipments,
		meta: calculatePagination(total, page, limit),
	};
}

async function getMyShipments(userId: string, query: IMyShipmentsQuery) {
	const customerId = await getCustomerId(userId);

	const { page, limit, skip } = parsePageParams(query.page, query.limit);

	const where: Prisma.ShipmentWhereInput = {
		customerId,
		isDeleted: false,
	};

	if (query.status) {
		where.status = query.status as Prisma.EnumShipmentStatusFilter;
	}

	if (query.search) {
		where.OR = ["trackingNumber", "recipientName", "destination", "origin"].map((field) => ({
			[field]: { contains: query.search, mode: "insensitive" },
		}));
	}

	const [shipments, total] = await prisma.$transaction([
		prisma.shipment.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				delivery: { select: { id: true, status: true, courier: { select: { name: true, contactNumber: true } } } },
			},
		}),
		prisma.shipment.count({ where }),
	]);

	return {
		data: shipments,
		meta: calculatePagination(total, page, limit),
	};
}

async function searchShipments(searchTerm: string) {
	if (!searchTerm || searchTerm.trim().length < 3) {
		throw new AppError(httpStatus.BAD_REQUEST, "Search term must be at least 3 characters.");
	}

	const shipments = await prisma.shipment.findMany({
		where: {
			OR: [
				{ trackingNumber: { contains: searchTerm, mode: "insensitive" } },
				{ recipientName: { contains: searchTerm, mode: "insensitive" } },
				{ recipientPhone: { contains: searchTerm } },
			],
			isDeleted: false,
		},
		take: 20,
		orderBy: { createdAt: "desc" },
		include: {
			customer: { select: { name: true, email: true } },
		},
	});

	return shipments;
}

async function getShipmentById(shipmentId: string) {
	const shipment = await prisma.shipment.findFirst({
		where: { id: shipmentId, isDeleted: false },
		include: {
			customer: { select: { id: true, name: true, email: true } },
			delivery: {
				select: {
					id: true,
					status: true,
					assignedAt: true,
					pickupAt: true,
					deliveredAt: true,
					failedReason: true,
					courier: {
						select: {
							id: true,
							name: true,
							contactNumber: true,
							vehicleType: true,
							vehicleNumber: true,
						},
					},
				},
			},
			payments: {
				select: {
					id: true,
					amount: true,
					status: true,
					currency: true,
					stripeSessionUrl: true,
					receiptUrl: true,
				},
			},
			trackingEvents: {
				orderBy: { createdAt: "asc" },
				select: { id: true, status: true, location: true, description: true, createdAt: true },
			},
		},
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	return shipment;
}

async function getShipmentByTracking(trackingNumber: string) {
	const shipment = await prisma.shipment.findFirst({
		where: { trackingNumber, isDeleted: false },
		include: {
			delivery: {
				select: {
					status: true,
					courier: { select: { name: true, contactNumber: true, vehicleType: true, vehicleNumber: true } },
				},
			},
			trackingEvents: {
				orderBy: { createdAt: "desc" },
				select: { status: true, location: true, description: true, createdAt: true },
			},
		},
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "No shipment found with this tracking number.");
	}

	return shipment;
}

async function updateShipment(shipmentId: string, payload: IUpdateShipmentRequest) {
	const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });

	if (!shipment || shipment.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (shipment.status !== "REQUESTED") {
		throw new AppError(httpStatus.BAD_REQUEST, "Shipment can only be updated while in REQUESTED status.");
	}

	const updated = await prisma.shipment.update({
		where: { id: shipmentId },
		data: { ...payload },
	});

	return updated;
}

async function softDeleteShipment(shipmentId: string, actorId: string) {
	const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });

	if (!shipment || shipment.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (shipment.status === "IN_TRANSIT" || shipment.status === "OUT_FOR_DELIVERY" || shipment.status === "DELIVERED") {
		throw new AppError(httpStatus.BAD_REQUEST, "Shipment cannot be deleted once it is being delivered.");
	}

	const updated = await prisma.$transaction([
		prisma.shipment.update({
			where: { id: shipmentId },
			data: { isDeleted: true, deletedAt: new Date() },
		}),
		prisma.auditLog.create({
			data: {
				actorId,
				actorRole: "ADMIN",
				action: "SHIPMENT_DELETED",
				resourceType: "Shipment",
				resourceId: shipmentId,
			},
		}),
	]);

	return updated[0];
}

async function cancelShipment(shipmentId: string, actorId: string) {
	const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });

	if (!shipment || shipment.isDeleted) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (!getNextStatuses(shipment.status).includes("CANCELLED")) {
		throw new AppError(httpStatus.BAD_REQUEST, `Shipment cannot be cancelled from status ${shipment.status}.`);
	}

	const updated = await prisma.$transaction(async (tx) => {
		await tx.shipment.update({
			where: { id: shipmentId },
			data: { status: "CANCELLED" },
		});

		await tx.trackingEvent.create({
			data: {
				shipmentId,
				status: "CANCELLED",
				description: "Shipment cancelled by customer.",
			},
		});

		if (shipment.paymentStatus === "PAID" || shipment.paymentStatus === "PENDING") {
			await tx.payment.updateMany({
				where: { shipmentId, status: { in: ["UNPAID", "PENDING", "PAID"] } },
				data: { status: "CANCELLED" },
			});
		}

		await tx.auditLog.create({
			data: {
				actorId,
				actorRole: "CUSTOMER",
				action: "SHIPMENT_CANCELLED",
				resourceType: "Shipment",
				resourceId: shipmentId,
			},
		});
	});

	return updated;
}

async function updateShipmentStatus(shipmentId: string, newStatus: string, actorId: string, actorRole: string) {
	const shipment = await prisma.shipment.findUnique({
		where: { id: shipmentId },
		select: { id: true, status: true, origin: true },
	});

	if (!shipment || shipment.id !== shipmentId) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (!getNextStatuses(shipment.status).includes(newStatus)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot transition shipment from ${shipment.status} to ${newStatus}.`,
		);
	}

	await prisma.$transaction(async (tx) => {
		await tx.shipment.update({
			where: { id: shipmentId },
			data: { status: newStatus as Prisma.EnumShipmentStatusFieldUpdateOperationsInput["set"] },
		});

		await tx.trackingEvent.create({
			data: {
				shipmentId,
				status: newStatus as "REQUESTED",
				location: shipment.origin ?? undefined,
				description: `Shipment status updated to ${newStatus}.`,
			},
		});

		await tx.auditLog.create({
			data: {
				actorId,
				actorRole,
				action: "SHIPMENT_STATUS_UPDATED",
				resourceType: "Shipment",
				resourceId: shipmentId,
				details: { from: shipment.status, to: newStatus },
			},
		});
	});

	return { shipmentId, status: newStatus };
}

export const ShipmentService = {
	createShipment,
	getShipments,
	getMyShipments,
	searchShipments,
	getShipmentById,
	getShipmentByTracking,
	updateShipment,
	softDeleteShipment,
	cancelShipment,
	updateShipmentStatus,
};