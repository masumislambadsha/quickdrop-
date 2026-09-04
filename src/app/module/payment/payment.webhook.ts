import type { Request, Response } from "express";
import httpStatus from "http-status";
import Stripe from "stripe";

import config from "../../config/index.js";

import { prisma } from "../../lib/prisma.js";

import { sendErrorResponse } from "../../utils/sendResponse.js";

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
	try {
		const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
		const signature = req.headers["stripe-signature"] as string | undefined;

		if (!signature) {
			sendErrorResponse(res, httpStatus.BAD_REQUEST, "Missing Stripe signature header.");
			return;
		}

		if (!config.stripe.webhookSecret) {
			sendErrorResponse(res, httpStatus.SERVICE_UNAVAILABLE, "Stripe webhook secret is not configured.");
			return;
		}

		const stripe = new Stripe(config.stripe.secretKey);

		let event: Stripe.Event;

		try {
			event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
		} catch {
			sendErrorResponse(res, httpStatus.BAD_REQUEST, "Invalid Stripe signature.");
			return;
		}

		if (event.type === "checkout.session.completed") {
			const session = event.data.object as Stripe.Checkout.Session;
			await handleCheckoutCompleted(session);
		} else if (event.type === "checkout.session.async_payment_failed") {
			const session = event.data.object as Stripe.Checkout.Session;
			await handleCheckoutFailed(session);
		}

		res.status(httpStatus.OK).json({ received: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Webhook error";
		res.status(httpStatus.BAD_REQUEST).json({ error: message });
	}
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
	const shipmentId = session.metadata?.shipmentId;
	if (!shipmentId) {
		return;
	}

	const exists = await prisma.payment.findFirst({
		where: { shipmentId },
		select: { id: true, status: true },
	});

	if (exists && exists.status === "PAID") {
		return;
	}

	await prisma.$transaction(async (tx) => {
		await tx.payment.updateMany({
			where: { shipmentId, status: { in: ["UNPAID", "PENDING"] } },
			data: {
				status: "PAID",
				stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
				receiptUrl: "receipt_url" in session ? String(session.receipt_url ?? "") : undefined,
				paidAt: new Date(),
			},
		});

		await tx.shipment.update({
			where: { id: shipmentId },
			data: {
				paymentStatus: "PAID",
			},
		});

		await tx.auditLog.create({
			data: {
				actorId: "stripe-webhook",
				actorRole: "SYSTEM",
				action: "PAYMENT_COMPLETED",
				resourceType: "Payment",
				resourceId: shipmentId,
				details: {
					sessionId: session.id,
					paymentIntentId:
						typeof session.payment_intent === "string" ? session.payment_intent : null,
				},
			},
		});
	});
}

async function handleCheckoutFailed(session: Stripe.Checkout.Session): Promise<void> {
	const shipmentId = session.metadata?.shipmentId;
	if (!shipmentId) {
		return;
	}

	await prisma.$transaction([
		prisma.payment.updateMany({
			where: { shipmentId, status: "PENDING" },
			data: { status: "FAILED" },
		}),
		prisma.shipment.update({
			where: { id: shipmentId },
			data: { paymentStatus: "FAILED" },
		}),
	]);
}