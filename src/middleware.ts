import { csrfSync } from 'csrf-sync';
import { verifyApiKey } from './utils';
import { NotFoundError } from './error';
import { NextFunction, Request, Response } from 'express';
import { validationResult } from 'express-validator';

export function notFoundMiddleware() {
	return (req: Request, res: Response, next: NextFunction) => {
		next(new NotFoundError());
	};
}

export const validateRequestMiddleware = (schemas: any) => {
	return async (req: Request, res: Response, next: NextFunction) => {
		try {
			await Promise.all(schemas.map((schema: any) => schema.run(req)));
			const result = validationResult(req) as any;

			// Always set input for POST, PATCH, PUT requests
			if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
				req.session.input = req.body;
			}

			if (result.isEmpty()) {
				// Clear errors if validation passes
				delete req.session.errors;
				return next();
			}

			const { errors } = result;
			const reshapedErrors = errors.reduce((acc: { [key: string]: string }, error: any) => {
				acc[error.path] = error.msg;
				return acc;
			}, {});

			// Note: is this a good idea? maybe we jus disable a toast since we already all errors state.input?
			// req.flash('error', Object.values(reshapedErrors));
			req.session.errors = reshapedErrors;

			return res.redirect('back');
		} catch (error) {
			next(error);
		}
	};
};

export const csrfMiddleware = (() => {
	const { csrfSynchronisedProtection } = csrfSync({
		getTokenFromRequest: (req: Request) => req.body.csrfToken || req.query.csrfToken,
	});

	return [
		csrfSynchronisedProtection,
		(req: Request, res: Response, next: NextFunction) => {
			// @ts-expect-error - trust be bro
			res.locals.csrfToken = req.csrfToken();
			next();
		},
	];
})();

export async function apiKeyAuthenticationMiddleware(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	try {
		const apiKey = req.header('X-API-KEY');

		if (!apiKey) {
			return res.status(401).json({ message: 'api key is missing' });
		}

		const apiKeyPayload = await verifyApiKey(apiKey);

		if (!apiKeyPayload) {
			return res.status(401).json({ message: 'invalid api key' });
		}

		req.apiKeyPayload = apiKeyPayload;

		next();
	} catch (error) {
		console.error('failed to auth api key', error);
		return res.status(500).json({ message: 'internal server error' });
	}
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
		res.locals.state = {
			user: req.session?.user || null,
			copyRightYear: new Date().getFullYear(),
			input: req.session?.input || {},
			errors: req.session?.errors || {},
			flash: {
				success: req.flash('success'),
				error: req.flash('error'),
				info: req.flash('info'),
				warning: req.flash('warning'),
			},
		};

		// Clear session input and errors after setting locals
		// This ensures they're available for the current request only
		delete req.session.input;
		delete req.session.errors;

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
