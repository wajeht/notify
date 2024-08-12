import { NotFoundError } from './error';
import { NextFunction, Request, Response } from 'express';

export function notFoundMiddleware() {
	return (req: Request, res: Response, next: NextFunction) => {
		throw new NotFoundError();
	};
}

export function errorMiddleware() {
	return async (
		error: Error & { statusCode: number },
		req: Request,
		res: Response,
		next: NextFunction,
	) => {
		return res.status(error.statusCode).render('error.html', {
			statusCode: error.statusCode,
			message: error.message,
		});
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
