import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";

import { Prisma } from "../../generated/prisma/client.js";

import config from "../config/index.js";

import { sendErrorResponse } from "../utils/sendResponse.js";

export function globalErrorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
	let statusCode: number = config.errorCode;
	let message: string = "Something went wrong";
	let errors: unknown[] | null = null;

	if (error instanceof ZodError) {
		statusCode = httpStatus.BAD_REQUEST;
		message = "Validation failed";
		errors = error.issues.map((issue) => ({
			field: issue.path.join("."),
			message: issue.message,
		}));
	} else if (error instanceof Error && "statusCode" in error) {
		statusCode = (error as { statusCode: number }).statusCode;
		message = error.message;
		errors = (error as { errors?: unknown[] | null }).errors ?? null;
	} else if (error instanceof Prisma.PrismaClientKnownRequestError) {
		if (error.code === "P2002") {
			statusCode = httpStatus.CONFLICT;
			const target = (error.meta?.target as string[] | undefined)?.join(", ") ?? "field";
			message = `Duplicate value for ${target}. Already exists.`;
		} else if (error.code === "P2025") {
			statusCode = httpStatus.NOT_FOUND;
			message = "Record not found.";
		} else if (error.code === "P2003") {
			statusCode = httpStatus.BAD_REQUEST;
			message = "Referenced record does not exist.";
		} else {
			statusCode = httpStatus.BAD_REQUEST;
			message = error.message;
		}
	} else if (error instanceof Error) {
		message = error.message;
	}

	if (config.app.env === "development") {
		console.error("[ERROR]", error);
	}

	sendErrorResponse(res, statusCode, message, errors);
}