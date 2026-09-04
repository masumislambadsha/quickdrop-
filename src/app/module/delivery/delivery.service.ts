import crypto from "node:crypto";
import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";

import { prisma } from "../../lib/prisma";

import { AppError } from "../../utils/AppError";

import {
	calculatePagination,
	parsePageParams,
} from "../../utils/pagination";

import { getNextDeliveryStatuses, getNextStatuses } from "../../utils/shipmentUtils";

import type {
	IAssignCourierRequest,
	IMyDeliveriesQuery,
	IUpdateDeliveryStatusParams,
	IUpdateDeliveryStatusRequest,
} from "./delivery.interface";

const DELIVERED_TO_SHIPMENT: Record<string, string> = {
	ASSIGNED: "PICKED_UP",
	PICKED_UP: "IN_TRANSIT",
	IN_TRANSIT: "OUT_FOR_DELIVERY",
	OUT_FOR_DELIVERY: "DELIVERED",
};

async function assignCourier(userId: string, shipmentId: string, payload: IAssignCourierRequest) {
	const shipment = await prisma.shipment.findFirst({
		where: { id: shipmentId, isDeleted: false },
		select: { id: true, status: true },
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	const existingDelivery = await prisma.delivery.findUnique({
		where: { shipmentId },
	});

	if (existingDelivery) {
		throw new AppError(httpStatus.CONFLICT, "A courier is already assigned to this shipment.");
	}

	const courier = await prisma.courier.findFirst({
		where: { userId: payload.courierId, availability: true, isDeleted: false },
		select: {
			id: true,
			name: true,
			availability: true,
			user: { select: { status: true } },
		},
	});

	if (!courier) {
		throw new AppError(httpStatus.NOT_FOUND, "Courier not found or not available.");
	}

	if (courier.user.status === "BLOCKED") {
		throw new AppError(httpStatus.BAD_REQUEST, "Selected courier is blocked.");
	}

	const result = await prisma.$transaction(async (tx) => {
		const isCourierBusy = await tx.delivery.count({
			where: {
				courierId: courier.id,
				status: { in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"] },
			},
		});

		if (isCourierBusy > 0) {
			throw new AppError(httpStatus.CONFLICT, "Selected courier is already busy with another delivery.");
		}

		const deliveryId = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

		const delivery = await tx.delivery.create({
			data: {
				id: deliveryId,
				shipmentId,
				courierId: courier.id,
				status: "ASSIGNED",
				assignedAt: new Date(),
			},
			include: {
				shipment: {
					select: {
						trackingNumber: true,
						origin: true,
						destination: true,
						weightKg: true,
					},
				},
			},
		});

		await tx.courier.update({
			where: { id: courier.id },
			data: { availability: false },
		});

		await tx.trackingEvent.create({
			data: {
				shipmentId,
				deliveryId: delivery.id,
				status: "PICKED_UP",
				location: "Courier assigned",
				description: `Courier assigned: ${courier.name}.`,
			},
		});

		await tx.auditLog.create({
			data: {
				actorId: userId,
				actorRole: "ADMIN",
				action: "COURIER_ASSIGNED",
				resourceType: "Delivery",
				resourceId: delivery.id,
				details: { courierId: payload.courierId, shipmentId },
			},
		});

		return delivery;
	});

	const { shipment: _shipment, ...deliveryData } = result;
	void _shipment;

	return deliveryData;
}

async function getMyDeliveries(courierUserId: string, query: IMyDeliveriesQuery) {
	const courier = await prisma.courier.findUnique({
		where: { userId: courierUserId },
		select: { id: true },
	});

	if (!courier) {
		throw new AppError(httpStatus.NOT_FOUND, "Courier profile not found.");
	}

	const { page, limit, skip } = parsePageParams(query.page, query.limit);

	const where: Prisma.DeliveryWhereInput = {
		courierId: courier.id,
	};

	if (query.status) {
		where.status = query.status as Prisma.EnumDeliveryStatusFilter;
	}

	const [deliveries, total] = await prisma.$transaction([
		prisma.delivery.findMany({
			where,
			skip,
			take: limit,
			orderBy: { assignedAt: "desc" },
			include: {
				shipment: {
					select: {
						id: true,
						trackingNumber: true,
						origin: true,
						destination: true,
						recipientName: true,
						recipientPhone: true,
						packageType: true,
						weightKg: true,
						status: true,
					},
				},
			},
		}),
		prisma.delivery.count({ where }),
	]);

	return {
		data: deliveries,
		meta: calculatePagination(total, page, limit),
	};
}

async function getAssignedDeliveries(courierUserId: string) {
	const courier = await prisma.courier.findUnique({
		where: { userId: courierUserId },
		select: { id: true },
	});

	if (!courier) {
		throw new AppError(httpStatus.NOT_FOUND, "Courier profile not found.");
	}

	const deliveries = await prisma.delivery.findMany({
		where: {
			courierId: courier.id,
			status: { in: ["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"] },
		},
		orderBy: { assignedAt: "desc" },
		include: {
			shipment: {
				select: {
					trackingNumber: true,
					origin: true,
					destination: true,
					recipientName: true,
					recipientPhone: true,
				},
			},
		},
	});

	return deliveries;
}

async function updateDeliveryStatus(
	user: { id: string; role: string },
	params: IUpdateDeliveryStatusParams,
	payload: IUpdateDeliveryStatusRequest,
) {
	const delivery = await prisma.delivery.findUnique({
		where: { id: params.id },
		include: {
			shipment: { select: { id: true, status: true } },
			courier: { select: { id: true, userId: true } },
		},
	});

	if (!delivery) {
		throw new AppError(httpStatus.NOT_FOUND, "Delivery not found.");
	}

	if (user.role === "COURIER" && delivery.courier.userId !== user.id) {
		throw new AppError(httpStatus.FORBIDDEN, "You can only update deliveries assigned to you.");
	}

	if (!getNextDeliveryStatuses(delivery.status).includes(payload.status)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Cannot transition delivery from ${delivery.status} to ${payload.status}.`,
		);
	}

	const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
		const data: Prisma.DeliveryUpdateInput = {
			status: payload.status as unknown as Prisma.EnumDeliveryStatusFieldUpdateOperationsInput["set"],
		};

		if (payload.status === "PICKED_UP") {
			data.pickupAt = new Date();
		}

		if (payload.status === "DELIVERED") {
			throw new AppError(httpStatus.BAD_REQUEST, "Use the confirm-delivery endpoint for final delivery.");
		}

		if (payload.status === "FAILED" && payload.failedReason) {
			data.failedReason = payload.failedReason;
		}

		const updated = await tx.delivery.update({
			where: { id: params.id },
			data,
			include: { shipment: true },
		});

		const shipmentStatus = DELIVERED_TO_SHIPMENT[payload.status];
		if (shipmentStatus && getNextStatuses(delivery.shipment.status).includes(shipmentStatus)) {
			await tx.shipment.update({
				where: { id: delivery.shipment.id },
				data: { status: shipmentStatus as Prisma.EnumShipmentStatusFieldUpdateOperationsInput["set"] },
			});
		}

		if (payload.status === "FAILED") {
			await tx.courier.update({
				where: { id: delivery.courier.id },
				data: { availability: true },
			});
		}

		if (["FAILED", "RETURNED"].includes(payload.status)) {
			await tx.shipment.update({
				where: { id: delivery.shipment.id },
				data: { status: "FAILED" },
			});
		}

		await tx.trackingEvent.create({
			data: {
				shipmentId: delivery.shipment.id,
				deliveryId: delivery.id,
				status: (shipmentStatus ?? "FAILED") as "REQUESTED",
				description: `Delivery status updated to ${payload.status}.`,
			},
		});

		await tx.auditLog.create({
			data: {
				actorId: user.id,
				actorRole: user.role,
				action: "DELIVERY_STATUS_UPDATED",
				resourceType: "Delivery",
				resourceId: delivery.id,
				details: { from: delivery.status, to: payload.status },
			},
		});

		return updated;
	});

	return result;
}

async function confirmDelivery(
	deliveryId: string,
	passcode: string,
	courierUserId: string | undefined,
) {
	const delivery = await prisma.delivery.findUnique({
		where: { id: deliveryId },
		include: {
			shipment: { select: { id: true, status: true, trackingNumber: true, customer: { select: { id: true } } } },
			courier: { select: { id: true, userId: true } },
		},
	});

	if (!delivery) {
		throw new AppError(httpStatus.NOT_FOUND, "Delivery not found.");
	}

	const expectedCode = deriveDeliveryCode(delivery.shipment.trackingNumber);
	if (passcode !== expectedCode) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid confirmation code.");
	}

	if (courierUserId && delivery.courier.userId !== courierUserId) {
		throw new AppError(httpStatus.FORBIDDEN, "You can only confirm deliveries assigned to you.");
	}

	await prisma.$transaction(async (tx) => {
		await tx.delivery.update({
			where: { id: delivery.id },
			data: { status: "DELIVERED", deliveredAt: new Date() },
		});

		await tx.shipment.update({
			where: { id: delivery.shipment.id },
			data: { status: "DELIVERED" },
		});

		await tx.courier.update({
			where: { id: delivery.courier.id },
			data: { availability: true },
		});

		await tx.payment.updateMany({
			where: { shipmentId: delivery.shipment.id, status: "PENDING" },
			data: { status: "PAID" },
		});

		await tx.trackingEvent.create({
			data: {
				shipmentId: delivery.shipment.id,
				deliveryId: delivery.id,
				status: "DELIVERED",
				description: "Shipment delivered successfully.",
			},
		});

		await tx.auditLog.create({
			data: {
				actorId: courierUserId ?? "unknown",
				actorRole: "COURIER",
				action: "DELIVERY_CONFIRMED",
				resourceType: "Delivery",
				resourceId: delivery.id,
			},
		});
	});

	return { message: "Delivery confirmed. Shipment marked as DELIVERED." };
}

function deriveDeliveryCode(trackingNumber: string): string {
	let sum = 0;
	for (const ch of trackingNumber) {
		sum += ch.charCodeAt(0);
	}
	return String((sum % 9000) + 1000);
}

async function getDeliveryById(deliveryId: string) {
	const delivery = await prisma.delivery.findUnique({
		where: { id: deliveryId },
		include: {
			shipment: {
				select: {
					trackingNumber: true,
					customer: { select: { name: true, email: true } },
					recipientName: true,
					recipientPhone: true,
					destination: true,
				},
			},
			courier: { select: { id: true, name: true, contactNumber: true } },
		},
	});

	if (!delivery) {
		throw new AppError(httpStatus.NOT_FOUND, "Delivery not found.");
	}

	return delivery;
}

export const DeliveryService = {
	assignCourier,
	getMyDeliveries,
	getAssignedDeliveries,
	updateDeliveryStatus,
	confirmDelivery,
	getDeliveryById,
};