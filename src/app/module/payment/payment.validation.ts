import { z } from "zod";

export const initiatePaymentSchema = z.object({
	body: z.object({
		shipmentId: z.string().min(1, "Shipment id is required"),
	}),
});

export const getPaymentStatusSchema = z.object({
	params: z.object({
		id: z.string().min(1, "Payment id is required"),
	}),
});

export const listPaymentsQuerySchema = z.object({
	query: z.object({
		page: z.coerce.number().int().min(1).optional(),
		limit: z.coerce.number().int().min(1).max(100).optional(),
		status: z.enum(["UNPAID", "PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED"]).optional(),
	}),
});