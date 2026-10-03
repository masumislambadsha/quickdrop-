import httpStatus from "http-status";
import Stripe from "stripe";
import type { Prisma } from "../../../generated/prisma/client.js";

import config from "../../config/index.js";

import { prisma } from "../../lib/prisma.js";

import { AppError } from "../../utils/AppError.js";

import { calculatePagination, parseCursorParams, parsePageParams, toCursorPage } from "../../utils/pagination.js";

import type { IPaymentQuery } from "./payment.interface.js";

function getStripe(): Stripe | null {
	if (!config.stripe.secretKey) {
		return null;
	}

	return new Stripe(config.stripe.secretKey);
}

/**
 * A stored checkout session can only be handed back to the customer if it
 * still exists in Stripe and is still open. Seeded/demo rows carry fabricated
 * ids (e.g. `cs_test_demo_36`) and abandoned checkouts expire after 24h —
 * both would send the customer to a broken "link is incomplete" page.
 */
async function isSessionUsable(stripe: Stripe, sessionId: string | null): Promise<boolean> {
	if (!sessionId) return false;

	try {
		const session = await stripe.checkout.sessions.retrieve(sessionId);
		return session.status === "open";
	} catch {
		return false;
	}
}

async function initiatePayment(customerUserId: string, shipmentId: string) {
	const shipment = await prisma.shipment.findFirst({
		where: {
			id: shipmentId,
			isDeleted: false,
		},
		include: {
			customer: {
				select: {
					userId: true,
					name: true,
					email: true,
				},
			},
		},
	});

	if (!shipment) {
		throw new AppError(httpStatus.NOT_FOUND, "Shipment not found.");
	}

	if (shipment.customer.userId !== customerUserId) {
		throw new AppError(httpStatus.FORBIDDEN, "You can only pay for your own shipments.");
	}

	const existing = await prisma.payment.findFirst({
		where: {
			shipmentId,
			status: { in: ["PENDING", "PAID"] },
		},
	});

	if (existing?.status === "PAID") {
		return {
			paymentId: existing.id,
			stripeSessionUrl: existing.stripeSessionUrl,
			status: existing.status,
			message: "Payment already processed for this shipment.",
		};
	}

	if (shipment.paymentStatus === "PAID") {
		throw new AppError(httpStatus.CONFLICT, "This shipment has already been paid.");
	}

	const stripe = getStripe();
	if (!stripe) {
		throw new AppError(
			httpStatus.SERVICE_UNAVAILABLE,
			"Online payment is not configured yet. Please contact support.",
		);
	}

	// Reuse an in-flight session so a double-click or a refresh doesn't create
	// duplicates, but never hand back a session that Stripe will reject.
	if (existing && (await isSessionUsable(stripe, existing.stripeSessionId))) {
		return {
			paymentId: existing.id,
			stripeSessionUrl: existing.stripeSessionUrl,
			stripeSessionId: existing.stripeSessionId,
			status: existing.status,
			message: "Resuming your existing payment.",
		};
	}

	const amountInCents = Math.round(shipment.cost * 100);
	const trackingLabel = `QuickDrop Shipment ${shipment.trackingNumber}`;

	const session = await stripe.checkout.sessions.create({
		mode: "payment",
		payment_method_types: ["card"],
		line_items: [
			{
				price_data: {
					currency: config.stripe.currency,
					product_data: { name: trackingLabel },
					unit_amount: amountInCents,
				},
				quantity: 1,
			},
		],
		success_url: `${config.app.frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
		cancel_url: `${config.app.frontendUrl}/payment/cancel`,
		metadata: {
			shipmentId,
			customerId: shipment.customerId,
		},
	});

	// Reuse the stale row (if any) rather than accumulating one dead payment
	// record per attempt; the webhook matches on shipmentId.
	const payment = existing
		? await prisma.payment.update({
				where: { id: existing.id },
				data: {
					status: "PENDING",
					stripeSessionId: session.id,
					stripeSessionUrl: session.url,
					stripePaymentIntentId: null,
					receiptUrl: null,
					paidAt: null,
				},
			})
		: await prisma.payment.create({
				data: {
					id: globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16),
					shipmentId,
					amount: shipment.cost,
					currency: config.stripe.currency,
					stripeSessionId: session.id,
					stripeSessionUrl: session.url,
					status: "PENDING",
				},
			});

	await prisma.$transaction([
		prisma.shipment.update({
			where: { id: shipmentId },
			data: { paymentStatus: "PENDING" },
		}),
		prisma.auditLog.create({
			data: {
				actorId: customerUserId,
				actorRole: "CUSTOMER",
				action: "PAYMENT_INITIATED",
				resourceType: "Payment",
				resourceId: payment.id,
				details: { amount: shipment.cost, sessionId: session.id },
			},
		}),
	]);

	return {
		paymentId: payment.id,
		stripeSessionUrl: session.url,
		stripeSessionId: session.id,
		status: payment.status,
	};
}

async function getPaymentStatus(paymentId: string) {
	const payment = await prisma.payment.findUnique({
		where: { id: paymentId },
		include: {
			shipment: {
				select: {
					trackingNumber: true,
					status: true,
					cost: true,
				},
			},
		},
	});

	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment not found.");
	}

	const stripe = getStripe();

	let liveStatus: string | null = null;
	if (stripe && payment.stripeSessionId) {
		try {
			const session = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
			liveStatus = session.payment_status;
		} catch {
			// fall back to stored status
		}
	}

	if (liveStatus === "paid" && payment.status !== "PAID") {
		const transaction = prisma.$transaction([
			prisma.payment.update({
				where: { id: payment.id },
				data: { status: "PAID", paidAt: new Date() },
			}),
			prisma.shipment.update({
				where: { id: payment.shipmentId },
				data: { paymentStatus: "PAID" },
			}),
		]);

		await transaction;
	}

	const updated = await prisma.payment.findUnique({ where: { id: paymentId } });

	return {
		payment: { ...updated, shipment: payment.shipment },
		resolvedLiveStatus: liveStatus,
	};
}

async function getAllPayments(query: IPaymentQuery) {
	const where: Prisma.PaymentWhereInput = {};

	if (query.status) {
		where.status = query.status as Prisma.EnumPaymentStatusFilter;
	}

	const paymentInclude = {
		shipment: {
			select: {
				trackingNumber: true,
				customer: { select: { name: true, email: true } },
			},
		},
	} as const;

	// ——— Cursor-based (infinite scroll / Load More) ———
	if (
		(typeof query.cursor === "string" && query.cursor.length > 0) ||
		query.page === undefined
	) {
		const { limit, takePlusOne } = parseCursorParams(query.limit);

		const cursorRow =
			typeof query.cursor === "string" && query.cursor.length > 0
				? await prisma.payment.findUnique({
						where: { id: query.cursor },
						select: { id: true },
					})
				: null;

		const [rows, total] = await prisma.$transaction([
			prisma.payment.findMany({
				where,
				...(cursorRow ? { cursor: { id: query.cursor }, skip: 1 } : {}),
				take: takePlusOne,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				include: paymentInclude,
			}),
			prisma.payment.count({ where }),
		]);

		return toCursorPage(rows, limit, total);
	}

	// ——— Legacy offset mode (?page=&limit=) ———
	const { page, limit, skip } = parsePageParams(query.page, query.limit);

	const [payments, total] = await prisma.$transaction([
		prisma.payment.findMany({
			where,
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
			include: {
				shipment: {
					select: {
						trackingNumber: true,
						customer: { select: { name: true, email: true } },
					},
				},
			},
		}),
		prisma.payment.count({ where }),
	]);

	return {
		data: payments,
		meta: calculatePagination(total, page, limit),
	};
}

export const PaymentService = {
	initiatePayment,
	getPaymentStatus,
	getAllPayments,
};