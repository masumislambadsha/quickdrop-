import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client.js";

import { redis } from "../../lib/redis.js";

import { prisma } from "../../lib/prisma.js";

import { AppError } from "../../utils/AppError.js";

import { calculatePagination, parsePageParams } from "../../utils/pagination.js";

import type { IAuditLogsQuery } from "./admin.interface.js";

const STATS_CACHE_KEY = "admin:dashboard:stats";
const STATS_CACHE_TTL = 60;

async function getDashboardStats() {
	const cached = await redis.get(STATS_CACHE_KEY);
	if (cached) {
		return JSON.parse(cached) as unknown;
	}

	const now = new Date();
	const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

	const [
		totalUsers,
		totalCustomers,
		totalCouriers,
		totalShipments,
		totalDeliveredShipments,
		totalInTransitShipments,
		totalPendingShipments,
		totalPayments,
		totalRevenue,
		newUsersLast30Days,
		newShipmentsLast30Days,
	] = await prisma.$transaction([
		prisma.user.count({ where: { isDeleted: false } }),
		prisma.customer.count({ where: { isDeleted: false } }),
		prisma.courier.count({ where: { isDeleted: false } }),
		prisma.shipment.count({ where: { isDeleted: false } }),
		prisma.shipment.count({ where: { isDeleted: false, status: "DELIVERED" } }),
		prisma.shipment.count({ where: { isDeleted: false, status: { in: ["IN_TRANSIT", "OUT_FOR_DELIVERY"] } } }),
		prisma.shipment.count({ where: { isDeleted: false, status: "REQUESTED" } }),
		prisma.payment.count({ where: { status: "PAID" } }),
		prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
		prisma.user.count({ where: { isDeleted: false, createdAt: { gte: thirtyDaysAgo } } }),
		prisma.shipment.count({ where: { isDeleted: false, createdAt: { gte: thirtyDaysAgo } } }),
	]);

	const stats = {
		totalUsers,
		totalCustomers,
		totalCouriers,
		totalShipments,
		totalDeliveredShipments,
		totalInTransitShipments,
		totalPendingShipments,
		totalPayments,
		totalRevenue: totalRevenue._sum.amount ?? 0,
		newUsersLast30Days,
		newShipmentsLast30Days,
		generatedAt: now.toISOString(),
	};

	await redis.set(STATS_CACHE_KEY, JSON.stringify(stats), STATS_CACHE_TTL);

	return stats;
}

async function getAuditLogs(query: IAuditLogsQuery) {
	const { page, limit, skip } = parsePageParams(query.page, query.limit);

	const where: Prisma.AuditLogWhereInput = {};

	if (query.actorId) {
		where.actorId = query.actorId;
	}

	if (query.action) {
		where.action = query.action;
	}

	const [logs, total] = await prisma.$transaction([
		prisma.auditLog.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
		}),
		prisma.auditLog.count({ where }),
	]);

	return {
		data: logs,
		meta: calculatePagination(total, page, limit),
	};
}

async function changeUserRole(actorId: string, userId: string, newRole: string) {
	if (actorId === userId) {
		throw new AppError(httpStatus.BAD_REQUEST, "You cannot change your own role.");
	}

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, role: true, customer: { select: { id: true } }, courier: { select: { id: true } } },
	});

	if (!user || user.id !== userId) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	if (user.role === newRole) {
		throw new AppError(httpStatus.BAD_REQUEST, "User already has this role.");
	}

	const result = await prisma.$transaction(async (tx) => {
		// When promoting customer -> courier, create a courier profile with defaults
		if (user.role === "CUSTOMER" && newRole === "COURIER") {
			if (user.customer) {
				const customer = await tx.customer.findUnique({ where: { id: user.customer.id } });
				if (customer) {
					await tx.courier.create({
						data: {
							userId,
							name: customer.name,
							email: customer.email,
							vehicleType: "BIKE",
							vehicleNumber: "N/A",
							availability: true,
							currentCity: customer.city,
						},
					});
				}
			}
		}

		// When downgrading courier -> customer, create a customer profile with defaults
		if (user.role === "COURIER" && newRole === "CUSTOMER" && !user.customer) {
			const courier = await tx.courier.findUnique({ where: { userId } });
			if (courier) {
				await tx.customer.create({
					data: {
						userId,
						name: courier.name,
						email: courier.email,
						contactNumber: courier.contactNumber,
						city: courier.currentCity,
					},
				});
			}
		}

		const updated = await tx.user.update({
			where: { id: userId },
			data: { role: newRole as Prisma.EnumRoleFieldUpdateOperationsInput["set"] },
		});

		await tx.auditLog.create({
			data: {
				actorId,
				actorRole: "ADMIN",
				action: "USER_ROLE_CHANGED",
				resourceType: "User",
				resourceId: userId,
				details: { from: user.role, to: newRole },
			},
		});

		return updated;
	});

	return result;
}

async function changeUserStatus(actorId: string, userId: string, newStatus: string) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, status: true },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	if (user.status === newStatus) {
		throw new AppError(httpStatus.BAD_REQUEST, "User already has this status.");
	}

	await prisma.$transaction(async (tx) => {
		await tx.user.update({
			where: { id: userId },
			data: { status: newStatus as Prisma.EnumUserStatusFieldUpdateOperationsInput["set"] },
		});

		if (newStatus === "BLOCKED") {
			const courier = await tx.courier.findUnique({ where: { userId } });
			if (courier) {
				await tx.courier.update({
					where: { id: courier.id },
					data: { availability: false },
				});
			}
		}

		await tx.auditLog.create({
			data: {
				actorId,
				actorRole: "ADMIN",
				action: "USER_STATUS_CHANGED",
				resourceType: "User",
				resourceId: userId,
				details: { from: user.status, to: newStatus },
			},
		});
	});

	return { userId, status: newStatus };
}

export const AdminService = {
	getDashboardStats,
	getAuditLogs,
	changeUserRole,
	changeUserStatus,
};