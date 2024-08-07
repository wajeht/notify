import { NextFunction, Request, Response } from "express";

export function notFoundMiddleware() {
	return (req: Request, res: Response, next: NextFunction) => {
			return res
				.status(404)
				.json({ message: 'not found'})
	};
}

export function errorMiddleware() {
	return async (error: Error, req: Request, res: Response, next: NextFunction) => {
		return res
			.status(500)
			.json({ message: 'internal server error'})
	};
}

export function catchAsyncErrorMiddleware<P = any, ResBody = any, ReqBody = any, ReqQuery = any>(
	fn: (
		req: Request<P, ResBody, ReqBody, ReqQuery>,
		res: Response<ResBody>,
		next: NextFunction,
	) => Response | Promise<Response<any>> | void | Promise<void>,
): (
	req: Request<P, ResBody, ReqBody, ReqQuery>,
	res: Response<ResBody>,
	next: NextFunction,
) => Promise<void> {
	return async (
		req: Request<P, ResBody, ReqBody, ReqQuery>,
		res: Response<ResBody>,
		next: NextFunction,
	): Promise<void> => {
		try {
			await fn(req, res, next);
		} catch (err) {
			next(err);
		}
	};
}
