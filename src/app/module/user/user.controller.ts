import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync.js";

import { sendResponse } from "../../utils/sendResponse.js";

import type { AuthRequest } from "../../middleware/checkAuth.js";

import { UserService } from "./user.service.js";

const getMe = catchAsync(async (req: AuthRequest, res) => {
	const result = await UserService.getUserProfile(req.user!.id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Profile retrieved successfully.",
		data: result,
	});
});

const updateMe = catchAsync(async (req: AuthRequest, res) => {
	const result = await UserService.updateUserProfile(req.user!.id, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Profile updated successfully.",
		data: result,
	});
});

const getAllUsers = catchAsync(async (req, res) => {
	const result = await UserService.getUsers(req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Users retrieved successfully.",
		data: result.data,
		meta: result.meta,
	});
});

export const UserController = {
	getMe,
	updateMe,
	getAllUsers,
};