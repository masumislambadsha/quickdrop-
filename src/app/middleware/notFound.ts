import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";

export function notFound(req: Request, res: Response, _next: NextFunction): void {
	res.status(httpStatus.NOT_FOUND).json({
		success: false,
		message: `Route not found: ${req.method} ${req.originalUrl}`,
		errors: null,
	});
}