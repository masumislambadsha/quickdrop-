import { rateLimit } from "express-rate-limit";

import config from "../config/index.js";

export const apiRateLimiter = rateLimit({
	windowMs: config.rateLimit.windowMs,
	limit: config.rateLimit.max,
	standardHeaders: "draft-7",
	legacyHeaders: false,
	message: {
		success: false,
		message: "Too many requests, please try again later.",
		errors: null,
	},
});

export const authRateLimiter = rateLimit({
	windowMs: 10 * 60 * 1000,
	limit: config.rateLimit.authMax,
	standardHeaders: "draft-7",
	legacyHeaders: false,
	message: {
		success: false,
		message: "Too many login/registration attempts. Please try again later.",
		errors: null,
	},
});