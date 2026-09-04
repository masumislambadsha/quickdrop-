import type { Request, Response } from "express";
import httpStatus from "http-status";

import type { AuthRequest } from "../../middleware/checkAuth";

import { catchAsync } from "../../utils/catchAsync";

import { sendResponse } from "../../utils/sendResponse";

import { PaymentService } from "./payment.service";

const initiatePayment = catchAsync(async (req: AuthRequest, res: Response) => {
	const result = await PaymentService.initiatePayment(req.user!.id, req.body.shipmentId);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		message: "Payment session created. Redirect the customer to Stripe Checkout.",
		data: result,
	});
});

const getPaymentStatus = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentService.getPaymentStatus(req.params.id as string);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Payment status retrieved.",
		data: result,
	});
});

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
	const result = await PaymentService.getAllPayments(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Payments retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

export const PaymentController = {
	initiatePayment,
	getPaymentStatus,
	getAllPayments,
};