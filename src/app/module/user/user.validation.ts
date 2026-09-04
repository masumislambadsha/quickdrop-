import { z } from "zod";

export const updateMeSchema = z.object({
	body: z.object({
		name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name cannot exceed 50 characters").optional(),
		contactNumber: z.string().max(20, "Contact number cannot exceed 20 characters").optional(),
		address: z.string().max(200, "Address cannot exceed 200 characters").optional(),
		city: z.string().max(50, "City cannot exceed 50 characters").optional(),
	}),
});

export const getUsersQuerySchema = z.object({
	query: z.object({
		page: z.coerce.number().int().min(1).optional(),
		limit: z.coerce.number().int().min(1).max(100).optional(),
		search: z.string().optional(),
		role: z.enum(["CUSTOMER", "COURIER", "ADMIN"]).optional(),
	}),
});