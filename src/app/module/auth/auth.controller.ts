import httpStatus from "http-status";

import { catchAsync } from "../../utils/catchAsync.js";

import { sendResponse } from "../../utils/sendResponse.js";

import { clearAuthCookies, getRefreshTokenFromRequest, setAuthCookies } from "../../utils/cookies.js";

import type { AuthRequest } from "../../middleware/checkAuth.js";

import { AuthService } from "./auth.service.js";

const registerUser = catchAsync(async (req, res) => {
	const result = await AuthService.registerUser(req.body);

	setAuthCookies(res, result.accessToken, result.refreshToken);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		message: "Account registered successfully.",
		data: result,
	});
});

const loginUser = catchAsync(async (req, res) => {
	const result = await AuthService.loginUser(req.body);

	setAuthCookies(res, result.accessToken, result.refreshToken);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Logged in successfully.",
		data: result,
	});
});

const refreshToken = catchAsync(async (req, res) => {
	const { refreshToken } = getRefreshTokenFromRequest(req);
	const result = await AuthService.refreshTokens(refreshToken);

	setAuthCookies(res, result.accessToken, result.refreshToken);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "New access token issued.",
		data: result,
	});
});

const logout = catchAsync(async (_req, res) => {
	clearAuthCookies(res);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Logged out successfully.",
		data: null,
	});
});

const changePassword = catchAsync(async (req: AuthRequest, res) => {
	const result = await AuthService.changePassword(req.user!.id, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		message: "Password changed successfully.",
		data: result,
	});
});

export const AuthController = {
	registerUser,
	loginUser,
	refreshToken,
	logout,
	changePassword,
};