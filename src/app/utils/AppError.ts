export class AppError extends Error {
	public readonly statusCode: number;
	public readonly isOperational: boolean;
	public readonly errors?: unknown[];

	constructor(statusCode: number, message: string, errors?: unknown[]) {
		super(message);
		this.statusCode = statusCode;
		this.isOperational = true;
		this.errors = errors;
		Error.captureStackTrace(this, this.constructor);
	}
}