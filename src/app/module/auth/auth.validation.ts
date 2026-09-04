import { z } from "zod";

export const registerSchema = z.object({
	body: z.object({
		name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name cannot exceed 50 characters"),
		email: z.string().trim().email("Please provide a valid email address"),
		password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password cannot exceed 100 characters"),
	}),
});

export const loginSchema = z.object({
	body: z.object({
		email: z.string().trim().email("Please provide a valid email address"),
		password: z.string().min(1, "Password is required"),
	}),
});

export const googleLoginSchema = z.object({
	body: z.object({
		code: z.string().min(1, "Authorization code is required").optional(),
		idToken: z.string().min(1, "ID token is required").optional(),
		redirectUri: z.string().url("Please provide a valid redirect URI").optional(),
	}).refine((v) => v.code || v.idToken, {
		message: "Either code or idToken is required",
	}),
});

export const googleCallbackSchema = z.object({
	query: z.object({
		code: z.string().min(1, "Authorization code is required"),
	}),
});

export const refreshTokenSchema = z.object({
	body: z.object({
		refreshToken: z.string().min(1, "Refresh token is required").optional(),
	}),
});

export const changePasswordSchema = z.object({
	body: z.object({
		oldPassword: z.string().min(1, "Old password is required"),
		newPassword: z.string().min(6, "New password must be at least 6 characters").max(100, "New password cannot exceed 100 characters"),
	}),
});