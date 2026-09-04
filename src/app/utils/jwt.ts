import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

import config from "../config/index.js";

import { AppError } from "./AppError.js";

type TokenType = "access" | "refresh";

function getSecret(type: TokenType): string {
	if (type === "access") {
		return config.jwt.accessSecret;
	}
	return config.jwt.refreshSecret;
}

export function signToken(payload: Record<string, unknown>, type: TokenType): string {
	return jwt.sign(payload, getSecret(type), {
		expiresIn: config.jwt[`${type}ExpiresIn`] as jwt.SignOptions["expiresIn"],
	} as SignOptions);
}

export function verifyToken(token: string, type: TokenType): JwtPayload {
	try {
		return jwt.verify(token, getSecret(type)) as JwtPayload;
	} catch {
		throw new AppError(401, "Invalid or expired token");
	}
}