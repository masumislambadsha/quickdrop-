import type { PackageType, PricingTier } from "../../../generated/prisma/enums";

export interface ICreateShipmentRequest {
	senderName: string;
	senderPhone: string;
	recipientName: string;
	recipientPhone: string;
	origin: string;
	destination: string;
	distanceKm: number;
	weightKg: number;
	packageType: PackageType;
	declaredValue?: number;
	pricingTier: PricingTier;
	notes?: string;
}

export interface IUpdateShipmentRequest {
	recipientName?: string;
	recipientPhone?: string;
	destination?: string;
	weightKg?: number;
	packageType?: PackageType;
	notes?: string;
}

export interface IListShipmentsQuery {
	page?: string;
	limit?: string;
	search?: string;
	status?: string;
}

export interface IMyShipmentsQuery {
	page?: string;
	limit?: string;
	search?: string;
	status?: string;
}