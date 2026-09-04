import type { Response } from "express";

import { AppError } from "../utils/AppError";

export const ACCESS_TOKEN_COOKIE = "accessToken";
export const REFRESH_TOKEN_COOKIE = "refreshToken";

const isProduction = process.env.NODE_ENV === "production";

function cookieOptions(maxAgeMs: number) {
	return {
		httpOnly: true,
		secure: isProduction,
		sameSite: "lax" as const,
		path: "/",
		maxAge: maxAgeMs,
	};
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
	const accessMaxAge = 15 * 60 * 1000; // 15m
	const refreshMaxAge = 7 * 24 * 60 * 60 * 1000; // 7d

	res.cookie(ACCESS_TOKEN_COOKIE, accessToken, cookieOptions(accessMaxAge));
	res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions(refreshMaxAge));
}

export function clearAuthCookies(res: Response): void {
	res.clearCookie(ACCESS_TOKEN_COOKIE, { path: "/" });
	res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/" });
}

export function getAccessTokenFromRequest(req: {
	headers: { authorization?: string };
	cookies?: Record<string, string>;
}): string {
	// 1) Bearer header (standard / Postman / APIs)
	const authHeader = req.headers.authorization;
	if (authHeader && authHeader.startsWith("Bearer ")) {
		return authHeader.split(" ")[1];
	}

	// 2) HTTP-only cookie (browser / session flow)
	const cookieToken = req.cookies?.[ACCESS_TOKEN_COOKIE];
	if (cookieToken) {
		return cookieToken;
	}

	throw new AppError(401, "You are not authorized. Please login to continue.");
}

export function getRefreshTokenFromRequest(req: {
	body?: { refreshToken?: unknown };
	cookies?: Record<string, string>;
}): { refreshToken: string; fromCookie: boolean } {
	const bodyToken = req.body?.refreshToken;
	if (typeof bodyToken === "string" && bodyToken.length > 0) {
		return { refreshToken: bodyToken, fromCookie: false };
	}

	const cookieToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
	if (cookieToken) {
		return { refreshToken: cookieToken, fromCookie: true };
	}

	throw new AppError(400, "Refresh token is required");
}