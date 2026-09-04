import { z } from "zod";

const PACKAGE_TYPES = ["DOCUMENT", "PARCEL", "FRAGILE", "PERISHABLE", "HEAVY"] as const;
const PRICING_TIERS = ["STANDARD", "EXPRESS", "SAME_DAY"] as const;

export const createShipmentSchema = z.object({
	body: z.object({
		senderName: z.string().min(2, "Sender name must be at least 2 characters").max(100),
		senderPhone: z.string().min(7, "Sender phone must be at least 7 characters").max(20),
		recipientName: z.string().min(2, "Recipient name must be at least 2 characters").max(100),
		recipientPhone: z.string().min(7, "Recipient phone must be at least 7 characters").max(20),
		origin: z.string().min(2, "Origin must be at least 2 characters").max(100),
		destination: z.string().min(2, "Destination must be at least 2 characters").max(100),
		distanceKm: z.number().positive("Distance must be greater than 0").max(100000),
		weightKg: z.number().positive("Weight must be greater than 0").max(100000),
		packageType: z.enum(PACKAGE_TYPES),
		declaredValue: z.number().nonnegative().optional(),
		pricingTier: z.enum(PRICING_TIERS).default("STANDARD"),
		notes: z.string().max(1000).optional(),
	}),
});

export const updateShipmentSchema = z.object({
	body: z.object({
		recipientName: z.string().min(2).max(100).optional(),
		recipientPhone: z.string().min(7).max(20).optional(),
		destination: z.string().min(2).max(100).optional(),
		weightKg: z.number().positive().max(100000).optional(),
		packageType: z.enum(PACKAGE_TYPES).optional(),
		notes: z.string().max(1000).optional(),
	}),
});

export const listShipmentsQuerySchema = z.object({
	query: z.object({
		page: z.coerce.number().int().min(1).optional(),
		limit: z.coerce.number().int().min(1).max(100).optional(),
		search: z.string().max(100).optional(),
		status: z.enum(["REQUESTED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "CANCELLED"]).optional(),
	}),
});

export const updateShipmentStatusSchema = z.object({
	body: z.object({
		status: z.enum(["REQUESTED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "CANCELLED"]),
	}),
});

export const cancelShipmentSchema = z.object({
	params: z.object({
		id: z.string().min(1, "Shipment id is required"),
	}),
});