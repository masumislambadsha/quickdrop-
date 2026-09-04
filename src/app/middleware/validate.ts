import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

import { AppError } from "../utils/AppError.js";

export function validate(schema: ZodSchema) {
	return (req: Request, _res: Response, next: NextFunction): void => {
		const result = schema.safeParse({
			body: req.body,
			query: req.query,
			params: req.params,
		});

		if (!result.success) {
			const issues = result.error.issues.map((issue) => ({
				field: issue.path.join("."),
				message: issue.message,
			}));
			throw new AppError(400, "Validation failed", issues);
		}

		next();
	};
}