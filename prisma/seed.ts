import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/client";
import type {
	DeliveryStatus,
	PackageType,
	PaymentStatus,
	PricingTier,
	ShipmentStatus,
} from "../src/generated/prisma/client";

const prisma = new PrismaClient({
	adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
});

const SALT_ROUNDS = 10;

function daysAgo(days: number): Date {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const CITIES = [
	"Dhaka",
	"Chattogram",
	"Sylhet",
	"Khulna",
	"Rajshahi",
	"Barishal",
	"Rangpur",
	"Mymensingh",
	"Comilla",
	"Jashore",
] as const;

const FIRST_NAMES = [
	"Rahim",
	"Karim",
	"Amina",
	"Jakir",
	"Nusrat",
	"Tanvir",
	"Sabina",
	"Mahfuz",
	"Farida",
	"Iqbal",
	"Sharmin",
	"Rakib",
	"Nadia",
	"Shahin",
	"Runa",
	"Arif",
	"Mariam",
	"Polash",
	"Shirin",
	"Riaz",
] as const;

const LAST_NAMES = [
	"Ahmed",
	"Begum",
	"Hossain",
	"Jahan",
	"Rahman",
	"Islam",
	"Khan",
	"Akter",
	"Chowdhury",
	"Pervez",
] as const;

async function main(): Promise<void> {
	console.log("Seeding QuickDrop database with demo data...");

	const adminPassword = await bcrypt.hash("Admin@1234", SALT_ROUNDS);
	const customerPassword = await bcrypt.hash("Customer@1234", SALT_ROUNDS);
	const courierPassword = await bcrypt.hash("Courier@1234", SALT_ROUNDS);

	// ===== Concrete demo user credentials =====
	// Admin
	const admin = await prisma.user.upsert({
		where: { email: "admin@quickdrop.com" },
		update: {},
		create: {
			name: "System Admin",
			email: "admin@quickdrop.com",
			password: adminPassword,
			authProvider: "CREDENTIAL",
			emailVerified: true,
			role: "ADMIN",
		},
	});
	console.log(`✓ Admin created: ${admin.email}`);

	// Primary demo customer
	const customer = await prisma.user.upsert({
		where: { email: "customer@quickdrop.com" },
		update: {},
		create: {
			name: "Demo Customer",
			email: "customer@quickdrop.com",
			password: customerPassword,
			authProvider: "CREDENTIAL",
			emailVerified: true,
			role: "CUSTOMER",
		},
	});
	const customerProfile = await prisma.customer.upsert({
		where: { userId: customer.id },
		update: {},
		create: {
			userId: customer.id,
			name: customer.name,
			email: customer.email,
			contactNumber: "+8801700000001",
			address: "House 12, Road 5, Dhanmondi",
			city: "Dhaka",
		},
	});
	console.log(`✓ Customer created: ${customer.email}`);

	// ===== Add 9 more demo customers (10 total) =====
	const customers = [customerProfile];
	for (let i = 1; i <= 9; i++) {
		const name = `${FIRST_NAMES[i]} ${LAST_NAMES[i % LAST_NAMES.length]}`;
		const email = `customer${i + 1}@quickdrop.com`;
		const city = CITIES[i % CITIES.length];
		const user = await prisma.user.upsert({
			where: { email },
			update: {},
			create: {
				name,
				email,
				password: customerPassword,
				authProvider: "CREDENTIAL",
				emailVerified: true,
				role: "CUSTOMER",
			},
		});
		const profile = await prisma.customer.upsert({
			where: { userId: user.id },
			update: {},
			create: {
				userId: user.id,
				name,
				email,
				contactNumber: `+8801700000${100 + i}`,
				address: `House ${i * 4}, Block ${String.fromCharCode(65 + (i % 5))}, ${city}`,
				city,
			},
		});
		customers.push(profile);
	}
	console.log(`✓ ${customers.length} customers are ready`);

	// ===== Primary demo couriers =====
	const courier1 = await prisma.user.upsert({
		where: { email: "courier@quickdrop.com" },
		update: {},
		create: {
			name: "Rahim Courier",
			email: "courier@quickdrop.com",
			password: courierPassword,
			authProvider: "CREDENTIAL",
			emailVerified: true,
			role: "COURIER",
		},
	});
	const courierProfile1 = await prisma.courier.upsert({
		where: { userId: courier1.id },
		update: {},
		create: {
			userId: courier1.id,
			name: courier1.name,
			email: courier1.email,
			contactNumber: "+8801700000002",
			vehicleType: "BIKE",
			vehicleNumber: "DHAKA-METRO-11-1234",
			availability: true,
			currentCity: "Dhaka",
		},
	});
	console.log(`✓ Courier created: ${courier1.email} (${courierProfile1.vehicleType})`);

	const courier2 = await prisma.user.upsert({
		where: { email: "courier2@quickdrop.com" },
		update: {},
		create: {
			name: "Karim Courier",
			email: "courier2@quickdrop.com",
			password: courierPassword,
			authProvider: "CREDENTIAL",
			emailVerified: true,
			role: "COURIER",
		},
	});
	const courierProfile2 = await prisma.courier.upsert({
		where: { userId: courier2.id },
		update: {},
		create: {
			userId: courier2.id,
			name: courier2.name,
			email: courier2.email,
			contactNumber: "+8801700000003",
			vehicleType: "CAR",
			vehicleNumber: "DHAKA-METRO-12-5678",
			availability: true,
			currentCity: "Chattogram",
		},
	});
	console.log(`✓ Courier created: ${courier2.email} (${courierProfile2.vehicleType})`);

	// ===== Add 8 more couriers (10 total) =====
	const couriers = [courierProfile1, courierProfile2];
	const vehicleTypes = ["BIKE", "CAR", "VAN", "CAR", "BIKE", "VAN", "BIKE", "CAR"];
	const vehicleLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
	for (let i = 0; i < 8; i++) {
		const name = `${FIRST_NAMES[10 + i]} ${LAST_NAMES[(i + 3) % LAST_NAMES.length]}`;
		const email = `courier${i + 3}@quickdrop.com`;
		const city = CITIES[(i + 2) % CITIES.length];
		const user = await prisma.user.upsert({
			where: { email },
			update: {},
			create: {
				name,
				email,
				password: courierPassword,
				authProvider: "CREDENTIAL",
				emailVerified: true,
				role: "COURIER",
			},
		});
		const profile = await prisma.courier.upsert({
			where: { userId: user.id },
			update: {},
			create: {
				userId: user.id,
				name,
				email,
				contactNumber: `+8801700000${120 + i}`,
				vehicleType: vehicleTypes[i],
				vehicleNumber: `DHAKA-METRO-${20 + i}-${vehicleLetters[i]}${1000 + i}`,
				availability: true,
				currentCity: city,
			},
		});
		couriers.push(profile);
	}
	console.log(`✓ ${couriers.length} couriers are ready`);

	// ===== Shipment generator =====
	// Expand an existing delivery status into a list of tracking events (hydrological history).
	function eventsFor(origin: string, destination: string, status: ShipmentStatus): {
		status: ShipmentStatus;
		location: string;
		description: string;
		offsetMins: number;
	}[] {
		const seq: { status: ShipmentStatus; description: string }[] = [
			{ status: "REQUESTED", description: "Shipment created and pickup scheduled" },
			{ status: "PICKED_UP", description: "Package picked up by courier" },
			{ status: "IN_TRANSIT", description: "Package in transit to destination hub" },
			{ status: "OUT_FOR_DELIVERY", description: "Package out for delivery" },
			{ status: "DELIVERED", description: "Package delivered to recipient" },
		];
		const targetIndex = seq.findIndex((s) => s.status === status);
		const relevant = targetIndex === -1 ? seq : seq.slice(0, targetIndex + 1);
		const locations = [origin, origin, destination, destination, destination];
		const base = -7 * 24 * 60; // shipments start 7 days ago
		return relevant.map((s, idx) => ({
			status: s.status,
			location: locations[idx],
			description: s.description,
			offsetMins: base + idx * 4 * 60,
		}));
	}

	function costFor(distanceKm: number, weightKg: number, tier: PricingTier, packageType: PackageType): number {
		const base = 150;
		const tierMultiplier = tier === "STANDARD" ? 1 : tier === "EXPRESS" ? 1.5 : 2;
		const typeMultiplier =
			packageType === "DOCUMENT" ? 0.7 : packageType === "FRAGILE" ? 1.4 : packageType === "PERISHABLE" ? 1.6 : packageType === "HEAVY" ? 1.8 : 1;
		return Number((base + distanceKm * 0.5 + weightKg * 25) * tierMultiplier * typeMultiplier);
	}

	const PACKAGE_TYPES: PackageType[] = ["DOCUMENT", "PARCEL", "FRAGILE", "PERISHABLE", "HEAVY"];
	const TIERS: PricingTier[] = ["STANDARD", "EXPRESS", "SAME_DAY"];

	// ===== Generate 60 shipments spread across customers, statuses, payment states =====
	const createdShipments: { id: string; trackingNumber: string; status: ShipmentStatus }[] = [];
	for (let i = 1; i <= 60; i++) {
		const trackingNumber = `QD-${String(100000 + i)}`;
		const existing = await prisma.shipment.findUnique({ where: { trackingNumber } });
		if (existing) {
			createdShipments.push({ id: existing.id, trackingNumber: existing.trackingNumber, status: existing.status });
			continue;
		}

		const customerProfileIdx = i % customers.length;
		const ownerProfile = customers[customerProfileIdx];
		const originCity = CITIES[i % CITIES.length];
		let destCity = CITIES[(i + 3) % CITIES.length];
		if (destCity === originCity) destCity = CITIES[(i + 5) % CITIES.length];

		const distanceKm = Number((120 + ((i * 37) % 380)).toFixed(1));
		const weightKg = Number((0.5 + ((i * 7) % 240) / 10).toFixed(1));

		// Distribute statuses: a healthy mix with a good spread for dashboards & filters.
		const statusRoll = i % 12;
		const status: ShipmentStatus =
			statusRoll === 0
				? "CANCELLED"
				: statusRoll === 1
					? "FAILED"
					: statusRoll <= 4
						? "REQUESTED"
						: statusRoll === 5
							? "PICKED_UP"
							: statusRoll <= 7
								? "IN_TRANSIT"
								: statusRoll <= 9
									? "OUT_FOR_DELIVERY"
									: "DELIVERED";

		const paymentStatus: PaymentStatus =
			status === "CANCELLED"
				? "CANCELLED"
				: status === "FAILED" && i % 2 === 0
					? "FAILED"
					: status === "DELIVERED" || status === "OUT_FOR_DELIVERY" || status === "IN_TRANSIT"
						? "PAID"
						: i % 3 === 0
							? "PENDING"
							: "UNPAID";

		const packageType = PACKAGE_TYPES[i % PACKAGE_TYPES.length];
		const pricingTier = TIERS[i % TIERS.length];
		const cost = Number(costFor(distanceKm, weightKg, pricingTier, packageType).toFixed(2));

		const shipment = await prisma.shipment.create({
			data: {
				trackingNumber,
				customerId: ownerProfile.id,
				senderName: ownerProfile.name,
				senderPhone: ownerProfile.contactNumber ?? "",
				recipientName: `${FIRST_NAMES[(i + 5) % FIRST_NAMES.length]} ${LAST_NAMES[(i * 2) % LAST_NAMES.length]}`,
				recipientPhone: `+8801800000${(i % 9000) + 1000}`,
				origin: originCity,
				destination: destCity,
				distanceKm,
				weightKg,
				packageType,
				declaredValue: Number((500 + ((i * 131) % 9500)).toFixed(0)),
				pricingTier,
				cost,
				notes: i % 4 === 0 ? `Please deliver after 6 PM to ${Title(destCity)}.` : null,
				status,
				paymentStatus,
				createdAt: daysAgo(7 - (i % 7)),
			},
		});

		// Add tracking events matching the status timeline.
		for (const ev of eventsFor(originCity, destCity, status)) {
			await prisma.trackingEvent.create({
				data: {
					shipmentId: shipment.id,
					status: ev.status,
					location: ev.location,
					description: ev.description,
					createdAt: new Date(Date.now() + ev.offsetMins * 60 * 1000),
				},
			});
		}

		createdShipments.push({ id: shipment.id, trackingNumber: shipment.trackingNumber, status: shipment.status });
		console.log(`✓ Shipment created: ${shipment.trackingNumber} [${status}/${paymentStatus}]`);
	}
	console.log(`✓ ${createdShipments.length} shipments ready`);

	function Title(s: string): string {
		return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
	}

	// ===== Deliveries for shipments that have progressed =====
	// Reserve a few couriers to ALWAYS stay free (availability: true, zero active
	// deliveries) so the assignment / delivery workflow can be demonstrated after
	// seeding. These couriers only ever carry terminal (delivered/failed) jobs.
	//   FREE_COURIERS = couriers[7] (courier8), couriers[8] (courier9), couriers[9] (courier10)
	const FREE_COURIER_IDX = new Set([7, 8, 9]);

	// Track a per-courier count of active (in-progress) deliveries so we never give
	// a courier more than one active job (matching the "busy" API rule).
	const activeJobPerCourier = new Map<string, number>();
	for (const courier of couriers) activeJobPerCourier.set(courier.id, 0);

	let deliveryCreated = 0;
	let activeCourierIdx = 0;
	const activeCapableIdx = couriers.map((_courier, i) => i).filter((i) => !FREE_COURIER_IDX.has(i));

	for (const s of createdShipments) {
		const actsLikeEnRoute = ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"].includes(s.status);
		if (!actsLikeEnRoute) continue;

		const existingDelivery = await prisma.delivery.findUnique({ where: { shipmentId: s.id } });
		if (existingDelivery) continue;

		const terminal = s.status === "DELIVERED" || s.status === "FAILED";

		// Couriers for a terminal job: spread across everyone (free couriers included).
		const terminalCourier = couriers[deliveryCreated % couriers.length];
		// Couriers for an ACTIVE job: must be ready to take a job and not already busy.
		let activeCourier: { id: string } | null = null;
		if (!terminal) {
			for (let k = 0; k < activeCapableIdx.length; k++) {
				const idx = activeCapableIdx[(activeCourierIdx + k) % activeCapableIdx.length];
				if ((activeJobPerCourier.get(couriers[idx].id) ?? 0) === 0) {
					activeCourier = couriers[idx];
					activeJobPerCourier.set(couriers[idx].id, 1);
					activeCourierIdx = (idx + 1) % activeCapableIdx.length;
					break;
				}
			}
		}

		// If no free courier is available, give this active job to someone but mark
		// them busy (keeps the dataset coherent even if it temporarily has a busy courier).
		const activeFallback = couriers[activeCapableIdx[activeCourierIdx % activeCapableIdx.length]];
		const courierProfile = terminal ? terminalCourier : (activeCourier ?? activeFallback);

		let deliveryStatus: DeliveryStatus;
		if (terminal) {
			deliveryStatus = s.status === "FAILED" ? "FAILED" : "DELIVERED";
		} else {
			deliveryStatus = s.status === "PICKED_UP" ? "PICKED_UP" : s.status === "IN_TRANSIT" ? "IN_TRANSIT" : s.status === "OUT_FOR_DELIVERY" ? "OUT_FOR_DELIVERY" : "ASSIGNED";
		}

		await prisma.delivery.create({
			data: {
				shipmentId: s.id,
				courierId: courierProfile.id,
				status: deliveryStatus,
				assignedAt: daysAgo(Math.max(1, 7 - (deliveryCreated % 5))),
				pickupAt: deliveryStatus === "ASSIGNED" ? null : daysAgo(Math.max(0, 6 - (deliveryCreated % 5))),
				deliveredAt: deliveryStatus === "DELIVERED" ? daysAgo(6 - (deliveryCreated % 5)) : null,
			},
		});

		const isBusy = !["DELIVERED", "FAILED", "RETURNED"].includes(deliveryStatus);
		await prisma.courier.update({
			where: { id: courierProfile.id },
			data: { availability: !isBusy },
		});
		deliveryCreated++;
	}
	console.log(`✓ ${deliveryCreated} deliveries created`);

	// ===== Payments for PAID / PENDING / FAILED shipments =====
	let paymentCreated = 0;
	for (const s of createdShipments) {
		const shipment = await prisma.shipment.findUnique({
			where: { trackingNumber: s.trackingNumber },
			select: { id: true, cost: true },
		});
		if (!shipment) continue;

		const wantPayment = ["PAID", "PENDING", "FAILED"].includes(
			s.status === "CANCELLED" ? "CANCELLED" : shipmentStatusPaymentState(s.status),
		);
		if (!wantPayment) continue;

		const existingPayment = await prisma.payment.findFirst({ where: { shipmentId: shipment.id } });
		if (existingPayment) continue;

		const status: PaymentStatus =
			s.status === "CANCELLED"
				? "CANCELLED"
				: s.status === "FAILED"
					? "FAILED"
					: shipmentStatusPaymentState(s.status);

		await prisma.payment.create({
			data: {
				shipmentId: shipment.id,
				amount: shipment.cost,
				currency: "usd",
				status,
				stripeSessionId: `cs_test_demo_${paymentCreated}`,
				stripeSessionUrl: `https://checkout.stripe.com/c/pay/cs_test_demo_${paymentCreated}`,
				stripePaymentIntentId:
					status === "PAID" ? `pi_test_demo_${paymentCreated}` : null,
				paidAt: status === "PAID" ? daysAgo(6 - (paymentCreated % 5)) : null,
				createdAt: daysAgo(6 - (paymentCreated % 5)),
			},
		});
		paymentCreated++;
	}
	console.log(`✓ ${paymentCreated} payments created`);

	function shipmentStatusPaymentState(status: ShipmentStatus): PaymentStatus {
		if (status === "DELIVERED" || status === "OUT_FOR_DELIVERY" || status === "IN_TRANSIT") return "PAID";
		if (status === "FAILED") return "FAILED";
		if (status === "CANCELLED") return "CANCELLED";
		return "PENDING";
	}

	// ===== Audit logs (last 30 days of admin activity) =====
	const actions = [
		{ action: "LOGIN", resourceType: "SESSION" },
		{ action: "CREATE", resourceType: "SHIPMENT" },
		{ action: "UPDATE", resourceType: "SHIPMENT" },
		{ action: "ASSIGN", resourceType: "DELIVERY" },
		{ action: "STATUS_CHANGE", resourceType: "SHIPMENT" },
		{ action: "PAYMENT_VERIFIED", resourceType: "PAYMENT" },
		{ action: "ROLE_CHANGE", resourceType: "USER" },
		{ action: "STATUS_CHANGE", resourceType: "USER" },
		{ action: "DELETE", resourceType: "SHIPMENT" },
		{ action: "DASHBOARD_VIEW", resourceType: "DASHBOARD" },
	];
	let auditCreated = 0;
for (let i = 0; i < 60; i++) {
			const base = actions[i % actions.length];
			const details = i % 3 === 0 ? { note: `Demo audit entry ${i + 1}`, count: i + 1 } : undefined;
			await prisma.auditLog.create({
				data: {
					actorId: admin.id,
					actorRole: "ADMIN",
					action: base.action,
					resourceType: base.resourceType,
					resourceId: i % 2 === 0 ? createdShipments[i % createdShipments.length]?.id ?? null : null,
					...(details ? { details } : {}),
					createdAt: daysAgo((i % 30) / 1),
				},
			});
			auditCreated++;
		}
	console.log(`✓ ${auditCreated} audit logs created`);

	console.log("\nSeed completed successfully!");
	console.log("\nDemo credentials:");
	console.log("  Admin    → admin@quickdrop.com    / Admin@1234");
	console.log("  Customer → customer@quickdrop.com / Customer@1234");
	console.log("  Courier  → courier@quickdrop.com  / Courier@1234");
	console.log("  Courier  → courier2@quickdrop.com / Courier@1234");
	console.log(`\nDemo volume: ${customers.length} customers, ${couriers.length} couriers, ${createdShipments.length} shipments, ${deliveryCreated} deliveries, ${paymentCreated} payments, ${auditCreated} audit logs.`);
}

main()
	.catch((error) => {
		console.error("Seed failed:", error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});