import { Router } from "express";

import { checkAuth, requireRole } from "../../middleware/checkAuth.js";

import { validate } from "../../middleware/validate.js";

import {
	cancelShipmentSchema,
	createShipmentSchema,
	listShipmentsQuerySchema,
	updateShipmentSchema,
	updateShipmentStatusSchema,
} from "./shipment.validation.js";

import { ShipmentController } from "./shipment.controller.js";

const router = Router();

router.post("/", checkAuth, requireRole("CUSTOMER"), validate(createShipmentSchema), ShipmentController.createShipment);

router.get(
	"/",
	checkAuth,
	requireRole("CUSTOMER", "COURIER", "ADMIN"),
	validate(listShipmentsQuerySchema),
	ShipmentController.getAllShipments,
);

router.get("/my", checkAuth, requireRole("CUSTOMER"), validate(listShipmentsQuerySchema), ShipmentController.getMyShipments);

router.get("/search", checkAuth, requireRole("CUSTOMER", "COURIER", "ADMIN"), ShipmentController.searchShipments);

router.get("/track/:trackingNumber", ShipmentController.trackShipment);

router.get("/:id", checkAuth, requireRole("CUSTOMER", "COURIER", "ADMIN"), ShipmentController.getShipmentById);

router.patch("/:id", checkAuth, requireRole("ADMIN"), validate(updateShipmentSchema), ShipmentController.updateShipment);

router.patch(
	"/:id/status",
	checkAuth,
	requireRole("ADMIN"),
	validate(updateShipmentStatusSchema),
	ShipmentController.updateShipmentStatus,
);

router.delete("/:id", checkAuth, requireRole("ADMIN"), validate(cancelShipmentSchema), ShipmentController.deleteShipment);

router.patch(
	"/:id/cancel",
	checkAuth,
	requireRole("CUSTOMER"),
	validate(cancelShipmentSchema),
	ShipmentController.cancelShipment,
);

export const shipmentRoutes = router;