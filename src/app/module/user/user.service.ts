import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client.js";

import { prisma } from "../../lib/prisma.js";

import { AppError } from "../../utils/AppError.js";

import { calculatePagination, parsePageParams } from "../../utils/pagination.js";

import type { IGetUsersFaqQuery, IUpdateMeRequest } from "./user.interface.js";

async function getUserProfile(userId: string) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
			status: true,
			imageUrl: true,
			authProvider: true,
			createdAt: true,
			customer: {
				select: {
					id: true,
					contactNumber: true,
					address: true,
					city: true,
				},
			},
			courier: {
				select: {
					id: true,
					contactNumber: true,
					vehicleType: true,
					vehicleNumber: true,
					availability: true,
					currentCity: true,
				},
			},
		},
	});

	if (!user || user.status === "DELETED") {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	return user;
}

async function updateUserProfile(userId: string, payload: IUpdateMeRequest) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { id: true, role: true },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found.");
	}

	if (user.role === "CUSTOMER") {
		const existing = await prisma.customer.findUnique({ where: { userId } });
		if (!existing) {
			throw new AppError(httpStatus.NOT_FOUND, "Customer profile not found.");
		}

		await prisma.$transaction([
			prisma.user.update({
				where: { id: userId },
				data: { name: payload.name },
			}),
			prisma.customer.update({
				where: { userId },
				data: {
					name: payload.name,
					contactNumber: payload.contactNumber,
					address: payload.address,
					city: payload.city,
				},
			}),
		]);

		return getUserProfile(userId);
	}

	if (user.role === "COURIER") {
		const existing = await prisma.courier.findUnique({ where: { userId } });
		if (!existing) {
			throw new AppError(httpStatus.NOT_FOUND, "Courier profile not found.");
		}

		await prisma.$transaction([
			prisma.user.update({
				where: { id: userId },
				data: { name: payload.name },
			}),
			prisma.courier.update({
				where: { userId },
				data: {
					name: payload.name,
					contactNumber: payload.contactNumber,
					currentCity: payload.city,
				},
			}),
		]);

		return getUserProfile(userId);
	}

	throw new AppError(httpStatus.BAD_REQUEST, "Profile updates are not available for admin accounts.");
}

async function getUsers(query: IGetUsersFaqQuery) {
	const { page, limit, skip } = parsePageParams(String(query.page), String(query.limit));
	const { search, role } = query;

	const searchableFields = ["name", "email"];

	const where: Prisma.UserWhereInput = {
		isDeleted: false,
	};

	if (role) {
		where.role = role as Prisma.UserWhereInput["role"];
	}

	if (search) {
		where.OR = searchableFields.map((field) => ({
			[field]: { contains: search, mode: "insensitive" },
		}));
	}

	const [users, total] = await prisma.$transaction([
		prisma.user.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				name: true,
				email: true,
				role: true,
				status: true,
				authProvider: true,
				createdAt: true,
				customer: {
					select: { contactNumber: true, city: true },
				},
				courier: {
					select: { contactNumber: true, vehicleType: true, availability: true },
				},
			},
		}),
		prisma.user.count({ where }),
	]);

	return {
		data: users,
		meta: calculatePagination(total, page, limit),
	};
}

export const UserService = {
	getUserProfile,
	updateUserProfile,
	getUsers,
};