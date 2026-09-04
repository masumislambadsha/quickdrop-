import type { Request, Response } from "express";
import httpStatus from "http-status";

import type { AuthRequest } from "../../middleware/checkAuth";

import { catchAsync } from "../../utils/catchAsync";

import { sendResponse } from "../../utils/sendResponse";

import { AdminService } from "./admin.service";

const getDashboardStats = catchAsync(async (_req: Request, res: Response) => {
	const result = await AdminService.getDashboardStats();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Dashboard statistics retrieved.",
		data: result,
	});
});

const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
	const result = await AdminService.getAuditLogs(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Audit logs retrieved.",
		data: result.data,
		meta: result.meta,
	});
});

const changeUserRole = catchAsync(async (req: AuthRequest, res: Response) => {
	const result = await AdminService.changeUserRole(req.user!.id, req.params.userId as string, req.body.role);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "User role updated.",
		data: result,
	});
});

const changeUserStatus = catchAsync(async (req: AuthRequest, res: Response) => {
	const result = await AdminService.changeUserStatus(req.user!.id, req.params.userId as string, req.body.status);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "User status updated.",
		data: result,
	});
});

export const AdminController = {
	getDashboardStats,
	getAuditLogs,
	changeUserRole,
	changeUserStatus,
};