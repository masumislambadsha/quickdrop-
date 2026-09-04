import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Request } from "express";
import helmet from "helmet";

import { apiRateLimiter } from "./app/middleware/rateLimiter";

import { globalErrorHandler } from "./app/middleware/globalErrorHandler";

import { notFound } from "./app/middleware/notFound";

import { adminRoutes } from "./app/module/admin/admin.route";

import { authRoutes } from "./app/module/auth/auth.route";

import { deliveryRoutes } from "./app/module/delivery/delivery.route";

import { handleStripeWebhook } from "./app/module/payment/payment.webhook";

import { paymentRoutes } from "./app/module/payment/payment.route";

import { shipmentRoutes } from "./app/module/shipment/shipment.route";

import { userRoutes } from "./app/module/user/user.route";

import config from "./app/config";

const app = express();

app.use(helmet());
app.use(
	cors({
		origin: [config.app.frontendUrl, config.app.backendUrl],
		credentials: true,
	}),
);

// Capture the raw request body for Stripe webhook signature verification.
app.use(
	express.json({
		limit: "10mb",
		verify: (req, _res, buf) => {
			(req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
		},
	}),
);
app.use(cookieParser());

app.get("/", (_req, res) => {
	res.json({
		success: true,
		message: "QuickDrop API is running",
		data: {
			name: "QuickDrop Courier & Logistics Platform",
			version: "1.0.0",
			docs: `${config.app.backendUrl}/api/v1`,
		},
	});
});

app.get("/health", (_req, res) => {
	res.json({
		success: true,
		message: "Server is healthy",
		data: { uptime: process.uptime(), timestamp: new Date().toISOString() },
	});
});

app.use(apiRateLimiter);

app.use("/api/v1/payments/webhook", handleStripeWebhook);

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/shipments", shipmentRoutes);
app.use("/api/v1/deliveries", deliveryRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use(notFound);
app.use(globalErrorHandler);

export default app;