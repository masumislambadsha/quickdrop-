import { Router } from "express";

import { checkAuth, requireRole } from "../../middleware/checkAuth";

import { validate } from "../../middleware/validate";

import { changeUserRoleSchema, changeUserStatusSchema, getAuditLogsQuerySchema } from "./admin.validation";

import { AdminController } from "./admin.controller";

const router = Router();

router.get("/dashboard-stats", checkAuth, requireRole("ADMIN"), AdminController.getDashboardStats);

router.get("/audit-logs", checkAuth, requireRole("ADMIN"), validate(getAuditLogsQuerySchema), AdminController.getAuditLogs);

router.patch(
	"/users/:userId/role",
	checkAuth,
	requireRole("ADMIN"),
	validate(changeUserRoleSchema),
	AdminController.changeUserRole,
);

router.patch(
	"/users/:userId/status",
	checkAuth,
	requireRole("ADMIN"),
	validate(changeUserStatusSchema),
	AdminController.changeUserStatus,
);

export const adminRoutes = router;