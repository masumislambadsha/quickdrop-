import bcrypt from "bcryptjs";
import httpStatus from "http-status";

import { prisma } from "../../lib/prisma";

import { AppError } from "../../utils/AppError";

import { signToken, verifyToken } from "../../utils/jwt";

import config from "../../config";

import type {
	IAuthResponse,
	IAuthUserResponse,
	IChangePasswordRequest,
	IGoogleLoginRequest,
	ILoginRequest,
	IRegisterRequest,
} from "./auth.interface";

async function issueTokens(user: {
	id: string;
	name: string;
	email: string;
	role: string;
}): Promise<IAuthResponse> {
	const payload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = signToken(payload, "access");
	const refreshToken = signToken(payload, "refresh");

	return { accessToken, refreshToken };
}

function toUserResponse(user: {
	id: string;
	name: string;
	email: string;
	role: string;
	status: string;
	needPasswordChange: boolean;
}): IAuthUserResponse {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		status: user.status,
		needPasswordChange: user.needPasswordChange,
	};
}

async function registerUser(payload: IRegisterRequest) {
	const { name, email, password } = payload;

	const existing = await prisma.user.findUnique({ where: { email } });
	if (existing) {
		throw new AppError(httpStatus.CONFLICT, "An account with this email already exists.");
	}

	const hashedPassword = await bcrypt.hash(password, config.jwt.bcryptSaltRounds);

	const user = await prisma.$transaction(async (tx) => {
		const created = await tx.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				authProvider: "CREDENTIAL",
				emailVerified: false,
			},
		});

		await tx.customer.create({
			data: {
				userId: created.id,
				name: created.name,
				email: created.email,
			},
		});

		return created;
	});

	const tokens = await issueTokens(user);
	await prisma.auditLog.create({
		data: {
			actorId: user.id,
			actorRole: user.role,
			action: "USER_REGISTERED",
			resourceType: "User",
			resourceId: user.id,
		},
	});

	return {
		user: toUserResponse(user),
		...tokens,
	};
}

async function loginUser(payload: ILoginRequest) {
	const { email, password } = payload;

	const user = await prisma.user.findUnique({ where: { email } });
	if (!user || user.isDeleted) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password.");
	}

	if (user.authProvider !== "CREDENTIAL" || !user.password) {
		throw new AppError(httpStatus.UNAUTHORIZED, "This account uses Google login. Please sign in with Google.");
	}

	const passwordMatches = await bcrypt.compare(password, user.password);
	if (!passwordMatches) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password.");
	}

	if (user.status === "BLOCKED") {
		throw new AppError(httpStatus.FORBIDDEN, "Your account has been blocked. Please contact support.");
	}

	const tokens = await issueTokens(user);

	return {
		user: toUserResponse(user),
		...tokens,
	};
}

async function googleLogin(payload: IGoogleLoginRequest) {
	const { code, idToken, redirectUri } = payload;

	if (!config.google.clientId || !config.google.clientSecret) {
		throw new AppError(httpStatus.SERVICE_UNAVAILABLE, "Google login is not configured on this server yet.");
	}

	try {
		const { OAuth2Client } = await import("google-auth-library");
		const client = new OAuth2Client({
			clientId: config.google.clientId,
			clientSecret: config.google.clientSecret,
			redirectUri: redirectUri ?? config.google.redirectUri,
		});

		let googleIdToken: string | null = idToken ?? null;

		// If we only have a code, exchange it for a token first (server-side flow).
		if (!googleIdToken && code) {
			const exchange = await client.getToken(code);
			googleIdToken = exchange.tokens.id_token ?? null;
		}

		if (!googleIdToken) {
			throw new AppError(httpStatus.UNAUTHORIZED, "Google login failed: no id token provided or received.");
		}

		const ticket = await client.verifyIdToken({
			idToken: googleIdToken,
			audience: config.google.clientId,
		});
		const payloadData = (ticket as { getPayload?: () => { email?: string | null; sub?: string | null; name?: string | null } | null }).getPayload?.();
		if (!payloadData?.email) {
			throw new AppError(httpStatus.UNAUTHORIZED, "Google login failed: no email returned.");
		}

		const googleEmail = payloadData.email.toLowerCase();
		const googleId = payloadData.sub ?? "";
		const googleName = payloadData.name ?? googleEmail.split("@")[0] ?? "";

		let user = await prisma.user.findUnique({ where: { email: googleEmail } });

		if (!user) {
			user = await prisma.$transaction(async (tx) => {
				const created = await tx.user.create({
					data: {
						name: googleName,
						email: googleEmail,
						googleId,
						authProvider: "GOOGLE",
						emailVerified: true,
					},
				});

				await tx.customer.create({
					data: {
						userId: created.id,
						name: created.name,
						email: created.email,
					},
				});

				return created;
			});
		} else if (!user.googleId) {
			await prisma.user.update({
				where: { id: user.id },
				data: { googleId, authProvider: "GOOGLE", emailVerified: true },
			});
		}

		if (user.status === "BLOCKED") {
			throw new AppError(httpStatus.FORBIDDEN, "Your account has been blocked. Please contact support.");
		}

		const tokensIssued = await issueTokens(user);

		return {
			user: toUserResponse(user),
			...tokensIssued,
		};
	} catch (error) {
		if (error instanceof AppError) {
			throw error;
		}
		throw new AppError(httpStatus.UNAUTHORIZED, "Google authentication failed. Please try again.");
	}
}

async function refreshTokens(refreshToken: string) {
	let payload: { userId: string; name: string; email: string; role: string };

	try {
		const decoded = verifyToken(refreshToken, "refresh");
		payload = {
			userId: decoded.userId as string,
			name: decoded.name as string,
			email: decoded.email as string,
			role: decoded.role as string,
		};
	} catch {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired refresh token.");
	}

	const user = await prisma.user.findUnique({
		where: { id: payload.userId },
		select: { id: true, name: true, email: true, role: true, status: true, isDeleted: true },
	});

	if (!user || user.isDeleted || user.status === "BLOCKED") {
		throw new AppError(httpStatus.UNAUTHORIZED, "Account not found or inactive.");
	}

	const tokens = await issueTokens(user);
	return tokens;
}

async function changePassword(userId: string, payload: IChangePasswordRequest) {
	const { oldPassword, newPassword } = payload;

	const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, password: true } });
	if (!user || !user.password) {
		throw new AppError(httpStatus.NOT_FOUND, "Account not found or password login not enabled.");
	}

	const matches = await bcrypt.compare(oldPassword, user.password);
	if (!matches) {
		throw new AppError(httpStatus.BAD_REQUEST, "Old password is incorrect.");
	}

	const hashed = await bcrypt.hash(newPassword, config.jwt.bcryptSaltRounds);
	await prisma.user.update({
		where: { id: userId },
		data: { password: hashed, needPasswordChange: false },
	});

	await prisma.auditLog.create({
		data: {
			actorId: userId,
			actorRole: "USER",
			action: "PASSWORD_CHANGED",
			resourceType: "User",
			resourceId: userId,
		},
	});

	return { message: "Password changed successfully." };
}

export const AuthService = {
	registerUser,
	loginUser,
	googleLogin,
	refreshTokens,
	changePassword,
};