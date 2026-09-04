import { z } from "zod";

const DELIVERY_STATUSES = [
	"ASSIGNED",
	"PICKED_UP",
	"IN_TRANSIT",
	"OUT_FOR_DELIVERY",
	"DELIVERED",
	"FAILED",
	"RETURNED",
] as const;

export const assignCourierSchema = z.object({
	body: z.object({
		courierId: z.string().min(1, "Courier id is required"),
		shipmentId: z.string().min(1, "Shipment id is required").optional(),
	}),
	params: z.object({
		id: z.string().min(1, "Shipment id is required"),
	}),
});

export const updateDeliveryStatusSchema = z.object({
	body: z.object({
		status: z.enum(DELIVERY_STATUSES),
		failedReason: z.string().max(500).optional(),
	}),
	params: z.object({
		id: z.string().min(1, "Delivery id is required"),
	}),
});

export const confirmDeliverySchema = z.object({
	body: z.object({
		code: z.string().min(1, "Confirmation code is required"),
	}),
	params: z.object({
		id: z.string().min(1, "Delivery id is required"),
	}),
});

export const getMyDeliveriesQuerySchema = z.object({
	query: z.object({
		page: z.coerce.number().int().min(1).optional(),
		limit: z.coerce.number().int().min(1).max(100).optional(),
		status: z.enum(DELIVERY_STATUSES).optional(),
	}),
});