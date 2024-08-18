import { csrfSync } from 'csrf-sync';
import { verifyApiKey } from './utils';
import { NotFoundError } from './error';
import { NextFunction, Request, Response } from 'express';

export function notFoundMiddleware() {
	return (req: Request, res: Response, next: NextFunction) => {
		next(new NotFoundError());
	};
}

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
			input: {},
		};

		if (req.method === 'POST') {
			res.locals.state.input = req.body;
			req.session.input = req.body;
		} else if (req.method === 'GET' && req.session?.input) {
			res.locals.state.input = req.session.input;
			delete req.session.input;
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
