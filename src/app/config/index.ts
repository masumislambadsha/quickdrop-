import "dotenv/config";

import httpStatus from "http-status";

/**
 * Vercel/other hosts may expose FRONTEND_URL with trailing slashes, whitespace,
 * or an empty string. Stripe rejects non-absolute redirect URLs ("Not a valid
 * URL"), so normalise once here instead of trusting the raw env value.
 */
function normalizeUrl(value: string | undefined, fallback: string): string {
	const trimmed = (value ?? "").trim().replace(/\/+$/, "");
	return trimmed.length > 0 ? trimmed : fallback;
}

const backendUrl = normalizeUrl(process.env.BACKEND_URL, "http://localhost:5000");
const frontendUrl = normalizeUrl(process.env.FRONTEND_URL, "http://localhost:3000");

// The browser only sends credentialed requests when the response allows the exact
// page origin, so CORS needs an allowlist rather than a single URL. Local dev
// servers are included because the frontend is developed against this API, and
// CORS_ORIGINS covers anything extra (e.g. a Vercel preview deployment).
const extraOrigins = (process.env.CORS_ORIGINS ?? "")
	.split(",")
	.map((origin) => normalizeUrl(origin, ""))
	.filter((origin) => origin.length > 0);

const config = {
	app: {
		env: process.env.NODE_ENV ?? "development",
		port: Number(process.env.PORT ?? 5000),
		backendUrl,
		frontendUrl,
		corsOrigins: [
			...new Set([
				frontendUrl,
				backendUrl,
				"http://localhost:3000",
				"http://localhost:3001",
				...extraOrigins,
			]),
		] as string[],
	},
	db: {
		url: process.env.DATABASE_URL ?? "",
	},
	jwt: {
		accessSecret: process.env.JWT_ACCESS_SECRET ?? "",
		refreshSecret: process.env.JWT_REFRESH_SECRET ?? "",
		accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
		refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
		bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 10),
	},
	stripe: {
		secretKey: process.env.STRIPE_SECRET_KEY ?? "",
		webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
		currency: process.env.STRIPE_CURRENCY ?? "usd",
	},
	google: {
		clientId: process.env.GOOGLE_CLIENT_ID ?? "",
		clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
		redirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
	},
	redis: {
		url: process.env.REDIS_URL ?? "",
	},
	openai: {
		apiKey: "",
	},
	rateLimit: {
		windowMs: 15 * 60 * 1000,
		max: 300,
		authMax: 20,
	},
	successCode: httpStatus.OK,
	errorCode: httpStatus.INTERNAL_SERVER_ERROR,
} as const;

export default config;