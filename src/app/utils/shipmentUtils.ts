import type { PackageType, PricingTier } from "../../generated/prisma/enums.js";

function generateTrackingNumber(): string {
	const timestamp = Date.now().toString(36).toUpperCase();
	const random = Math.random().toString(36).substring(2, 8).toUpperCase();
	return `QD-${timestamp}-${random}`;
}

function formatToTk(amount: number): number {
	return Number(amount.toFixed(2));
}

function getPricingMultiplier(tier: PricingTier): number {
	switch (tier) {
		case "EXPRESS":
			return 1.5;
		case "SAME_DAY":
			return 2;
		case "STANDARD":
		default:
			return 1;
	}
}

function getPackageTypeMultiplier(packageType: PackageType): number {
	switch (packageType) {
		case "FRAGILE":
		case "PERISHABLE":
			return 1.3;
		case "HEAVY":
			return 1.5;
		case "DOCUMENT":
			return 0.8;
		default:
			return 1;
	}
}

export function calculateShippingCost(params: {
	distanceKm: number;
	weightKg: number;
	pricingTier: PricingTier;
	packageType: PackageType;
}): number {
	const { distanceKm, weightKg, pricingTier, packageType } = params;

	const baseRatePerKm = 5;
	const weightRatePerKg = 10;
	const handlingFee = 30;

	const distanceCost = Math.max(distanceKm, 1) * baseRatePerKm;
	const weightCost = Math.max(weightKg, 0.5) * weightRatePerKg;
	const subtotal = distanceCost + weightCost + handlingFee;

	const tierMultiplier = getPricingMultiplier(pricingTier);
	const typeMultiplier = getPackageTypeMultiplier(packageType);

	return formatToTk(subtotal * tierMultiplier * typeMultiplier);
}

const STATUS_TRANSITIONS: Record<string, string[]> = {
	REQUESTED: ["PICKED_UP", "CANCELLED", "FAILED"],
	PICKED_UP: ["IN_TRANSIT", "CANCELLED", "FAILED"],
	IN_TRANSIT: ["OUT_FOR_DELIVERY", "FAILED"],
	OUT_FOR_DELIVERY: ["DELIVERED", "FAILED"],
	DELIVERED: [],
	FAILED: ["REQUESTED"],
	CANCELLED: [],
};

function getNextStatuses(current: string): string[] {
	return STATUS_TRANSITIONS[current] ?? [];
}

const DELIVERY_STATUS_TRANSITIONS: Record<string, string[]> = {
	ASSIGNED: ["PICKED_UP", "FAILED", "RETURNED", "CANCELLED"],
	PICKED_UP: ["IN_TRANSIT", "FAILED", "RETURNED", "CANCELLED"],
	IN_TRANSIT: ["OUT_FOR_DELIVERY", "FAILED", "RETURNED", "CANCELLED"],
	OUT_FOR_DELIVERY: ["DELIVERED", "FAILED", "RETURNED", "CANCELLED"],
	DELIVERED: [],
	FAILED: [],
	RETURNED: [],
};

function getNextDeliveryStatuses(current: string): string[] {
	return DELIVERY_STATUS_TRANSITIONS[current] ?? [];
}

export {
	generateTrackingNumber,
	formatToTk,
	getNextStatuses,
	getNextDeliveryStatuses,
	STATUS_TRANSITIONS,
	DELIVERY_STATUS_TRANSITIONS,
};