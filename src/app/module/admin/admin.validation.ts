import { z } from "zod";

export const changeUserRoleSchema = z.object({
	body: z.object({
		role: z.enum(["CUSTOMER", "COURIER", "ADMIN"]),
	}),
	params: z.object({
		userId: z.string().min(1, "User id is required"),
	}),
});

export const changeUserStatusSchema = z.object({
	body: z.object({
		status: z.enum(["ACTIVE", "BLOCKED"]),
	}),
	params: z.object({
		userId: z.string().min(1, "User id is required"),
	}),
});

export const getAuditLogsQuerySchema = z.object({
	query: z.object({
		page: z.coerce.number().int().min(1).optional(),
		limit: z.coerce.number().int().min(1).max(100).optional(),
		actorId: z.string().min(1).optional(),
		action: z.string().min(1).optional(),
	}),
});