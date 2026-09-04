import type { Request, Response } from "express";
import httpStatus from "http-status";

import type { AuthRequest } from "../../middleware/checkAuth";

import { catchAsync } from "../../utils/catchAsync";

import { sendResponse } from "../../utils/sendResponse";

import { DeliveryService } from "./delivery.service";

const assignCourier = catchAsync(async (req: AuthRequest, res: Response) => {
	const result = await DeliveryService.assignCourier(
		req.user!.id,
		req.params.id as string,
		{ courierId: req.body.courierId },
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		message: "Courier assigned to shipment successfully.",
		data: result,
	});
});

const getMyDeliveries = catchAsync(async (req: AuthRequest, res: Response) => {
	const result = await DeliveryService.getMyDeliveries(req.user!.id, req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Your deliveries retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

const getAssignedForCourier = catchAsync(async (req: AuthRequest, res: Response) => {
	const result = await DeliveryService.getAssignedDeliveries(req.user!.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Assigned deliveries retrieved.",
		data: result,
	});
});

const updateDeliveryStatus = catchAsync(async (req: AuthRequest, res: Response) => {
	const result = await DeliveryService.updateDeliveryStatus(
		{ id: req.user!.id, role: req.user!.role },
		{ id: req.params.id as string },
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Delivery status updated.",
		data: result,
	});
});

const confirmDelivery = catchAsync(async (req: AuthRequest, res: Response) => {
	const result = await DeliveryService.confirmDelivery(req.params.id as string, req.body.code, req.user!.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: result.message,
		data: null,
	});
});

const getDeliveryById = catchAsync(async (req: Request, res: Response) => {
	const result = await DeliveryService.getDeliveryById(req.params.id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Delivery retrieved successfully.",
		data: result,
	});
});

export const DeliveryController = {
	assignCourier,
	getMyDeliveries,
	getAssignedForCourier,
	updateDeliveryStatus,
	confirmDelivery,
	getDeliveryById,
};