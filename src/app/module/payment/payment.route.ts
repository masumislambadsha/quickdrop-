import { Router } from "express";

import { checkAuth, requireRole } from "../../middleware/checkAuth.js";

import { validate } from "../../middleware/validate.js";

import { getPaymentStatusSchema, initiatePaymentSchema, listPaymentsQuerySchema } from "./payment.validation.js";

import { PaymentController } from "./payment.controller.js";

const router = Router();

router.post("/", checkAuth, requireRole("CUSTOMER"), validate(initiatePaymentSchema), PaymentController.initiatePayment);

router.get("/", checkAuth, requireRole("ADMIN"), validate(listPaymentsQuerySchema), PaymentController.getAllPayments);

router.get(
	"/:id",
	checkAuth,
	requireRole("CUSTOMER", "ADMIN"),
	validate(getPaymentStatusSchema),
	PaymentController.getPaymentStatus,
);

export const paymentRoutes = router;