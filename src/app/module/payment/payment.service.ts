import httpStatus from "http-status";
import Stripe from "stripe";
import type { Prisma } from "../../../generated/prisma/client";

import config from "../../config";

import { prisma } from "../../lib/prisma";

import { AppError } from "../../utils/AppError";

import { calculatePagination, parsePageParams } from "../../utils/pagination";

import type { IPaymentQuery } from "./payment.interface";

function getStripe(): Stripe | null {
	if (!config.stripe.secretKey) {
		return null;
	}

	return new Stripe(config.stripe.secretKey);
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

	const existingPending = await prisma.payment.findFirst({
		where: {
			shipmentId,
			status: { in: ["PENDING", "PAID"] },
		},
	});

	if (existingPending) {
		return {
			paymentId: existingPending.id,
			stripeSessionUrl: existingPending.stripeSessionUrl,
			status: existingPending.status,
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

	const amountInCents = Math.round(shipment.cost * 100);
	const trackingLabel = `QuickDrop Shipment ${shipment.trackingNumber}`;

	const session = await stripe.checkout.sessions.create({
		mode: "payment",
		payment_method_types: ["card"],
		line_items: [
			{
				price_data: {
					currency: "usd",
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

	const paymentId = globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 16);

	const payment = await prisma.payment.create({
		data: {
			id: paymentId,
			shipmentId,
			amount: shipment.cost,
			currency: "usd",
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
	const { page, limit, skip } = parsePageParams(query.page, query.limit);

	const where: Prisma.PaymentWhereInput = {};

	if (query.status) {
		where.status = query.status as Prisma.EnumPaymentStatusFilter;
	}

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