import type { NextFunction, Request, Response } from "express";

import { prisma } from "../lib/prisma";

import { AppError } from "../utils/AppError";

import { getAccessTokenFromRequest } from "../utils/cookies";

import { verifyToken } from "../utils/jwt";

export interface AuthUser {
	id: string;
	name: string;
	email: string;
	role: string;
}

export interface AuthRequest extends Request {
	user?: AuthUser;
}

export function checkAuth(req: Request, _res: Response, next: NextFunction): void {
	try {
		const token = getAccessTokenFromRequest(req);

		const payload = verifyToken(token, "access");

		(req as AuthRequest).user = {
			id: payload.userId as string,
			name: payload.name as string,
			email: payload.email as string,
			role: payload.role as string,
		};
		next();
	} catch (error) {
		next(error);
	}
}

export function requireRole(...roles: string[]) {
	return (req: Request, _res: Response, next: NextFunction): void => {
		try {
			const userRole = (req as AuthRequest).user?.role;

			if (!userRole) {
				throw new AppError(401, "You are not authorized. Please login to continue.");
			}

			if (!roles.includes(userRole)) {
				throw new AppError(403, `This action requires the following role(s): ${roles.join(", ")}.`);
			}

			next();
		} catch (error) {
			next(error);
		}
	};
}

export async function checkBlockedUser(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
	try {
		if (req.user?.id) {
			const user = await prisma.user.findUnique({
				where: { id: req.user.id },
				select: { status: true, isDeleted: true },
			});

			if (!user || user.isDeleted || user.status === "BLOCKED") {
				throw new AppError(401, "Your account is blocked or deactivated.");
			}
		}
		next();
	} catch (error) {
		next(error);
	}
}