import { NotFoundError } from './error';
import { NextFunction, Request, Response } from 'express';

export function notFoundMiddleware() {
	return (req: Request, res: Response, next: NextFunction) => {
		next(new NotFoundError());
	};
}

export async function authenticationMiddleware(req: Request, res: Response, next: NextFunction) {
	try {
		if (!req.session?.user) {
			return res.redirect('/login');
		}

		next();
	} catch (error) {
		next(error);
	}
}

export async function appLocalStateMiddleware(req: Request, res: Response, next: NextFunction) {
	try {
		const user = req.session?.user;

		if (user) {
			res.locals.state = {
				user: user,
				copyRightYear: new Date().getFullYear(),
			};
		}

		next();
	} catch (error) {
		next(error);
	}
}

export function errorMiddleware() {
	return async (
		error: Error & { statusCode?: number },
		req: Request,
		res: Response,
		next: NextFunction,
	) => {
		return res.status(error.statusCode || 500).render('error.html', {
			statusCode: error.statusCode || 500,
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
