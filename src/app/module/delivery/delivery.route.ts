import { Router } from "express";

import { checkAuth, requireRole } from "../../middleware/checkAuth";

import { validate } from "../../middleware/validate";

import {
	assignCourierSchema,
	confirmDeliverySchema,
	getMyDeliveriesQuerySchema,
	updateDeliveryStatusSchema,
} from "./delivery.validation";

import { DeliveryController } from "./delivery.controller";

const router = Router();

router.post(
	"/:id/assign-courier",
	checkAuth,
	requireRole("ADMIN"),
	validate(assignCourierSchema),
	DeliveryController.assignCourier,
);

router.get(
	"/",
	checkAuth,
	requireRole("COURIER"),
	validate(getMyDeliveriesQuerySchema),
	DeliveryController.getMyDeliveries,
);

router.get("/assigned", checkAuth, requireRole("COURIER"), DeliveryController.getAssignedForCourier);

router.get("/:id", checkAuth, requireRole("ADMIN", "COURIER"), DeliveryController.getDeliveryById);

router.patch(
	"/:id/status",
	checkAuth,
	requireRole("COURIER", "ADMIN"),
	validate(updateDeliveryStatusSchema),
	DeliveryController.updateDeliveryStatus,
);

router.post(
	"/:id/confirm",
	checkAuth,
	requireRole("COURIER", "ADMIN"),
	validate(confirmDeliverySchema),
	DeliveryController.confirmDelivery,
);

export const deliveryRoutes = router;