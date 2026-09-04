import type { Request, Response } from "express";
import httpStatus from "http-status";

import type { AuthRequest } from "../../middleware/checkAuth";

import { catchAsync } from "../../utils/catchAsync";

import { sendResponse } from "../../utils/sendResponse";

import { ShipmentService } from "./shipment.service";

const createShipment = catchAsync(async (req: AuthRequest, res: Response) => {
	const result = await ShipmentService.createShipment(req.user!.id, req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		message: "Shipment created successfully.",
		data: result,
	});
});

const getAllShipments = catchAsync(async (req: Request, res: Response) => {
	const result = await ShipmentService.getShipments(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Shipments retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

const getMyShipments = catchAsync(async (req: AuthRequest, res: Response) => {
	const result = await ShipmentService.getMyShipments(req.user!.id, req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Your shipments retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

const searchShipments = catchAsync(async (req: Request, res: Response) => {
	const result = await ShipmentService.searchShipments(req.query.search as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Search results retrieved.",
		data: result,
	});
});

const getShipmentById = catchAsync(async (req: Request, res: Response) => {
	const result = await ShipmentService.getShipmentById(req.params.id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Shipment retrieved successfully.",
		data: result,
	});
});

const trackShipment = catchAsync(async (req: Request, res: Response) => {
	const result = await ShipmentService.getShipmentByTracking(req.params.trackingNumber as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Shipment tracking details retrieved.",
		data: result,
	});
});

const updateShipment = catchAsync(async (req: Request, res: Response) => {
	const result = await ShipmentService.updateShipment(req.params.id as string, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Shipment updated successfully.",
		data: result,
	});
});

const deleteShipment = catchAsync(async (req: AuthRequest, res: Response) => {
	const result = await ShipmentService.softDeleteShipment(req.params.id as string, req.user!.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Shipment deleted successfully.",
		data: result,
	});
});

const cancelShipment = catchAsync(async (req: AuthRequest, res: Response) => {
	const result = await ShipmentService.cancelShipment(req.params.id as string, req.user!.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Shipment cancelled successfully.",
		data: result,
	});
});

const updateShipmentStatus = catchAsync(async (req: AuthRequest, res: Response) => {
	const result = await ShipmentService.updateShipmentStatus(
		req.params.id as string,
		req.body.status,
		req.user!.id,
		req.user!.role,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Shipment status updated successfully.",
		data: result,
	});
});

export const ShipmentController = {
	createShipment,
	getAllShipments,
	getMyShipments,
	searchShipments,
	getShipmentById,
	trackShipment,
	updateShipment,
	deleteShipment,
	cancelShipment,
	updateShipmentStatus,
};