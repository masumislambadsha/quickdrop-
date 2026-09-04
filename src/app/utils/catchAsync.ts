import type { NextFunction, Request, RequestHandler, Response } from "express";

export const catchAsync =
	(fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
	(req, res, next) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};