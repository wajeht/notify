import helmet from 'helmet';
import { db, redis } from './db/db';
import { csrfSync } from 'csrf-sync';
import session from 'express-session';
import { verifyApiKey } from './utils';
import { NotFoundError } from './error';
import rateLimit from 'express-rate-limit';
import connectRedisStore from 'connect-redis';
import { sessionConfig, appConfig } from './config';
import rateLimitRedisStore from 'rate-limit-redis';
import { validationResult } from 'express-validator';
import { NextFunction, Request, Response } from 'express';

export function notFoundMiddleware() {
	return (req: Request, res: Response, next: NextFunction) => {
		throw NotFoundError();
	};
}

export function helmetMiddleware() {
	return helmet({
		contentSecurityPolicy: {
			useDefaults: true,
			directives: {
				...helmet.contentSecurityPolicy.getDefaultDirectives(),
				'default-src': ["'self'", 'plausible.jaw.dev', 'notify.jaw.dev', 'jaw.lol'],
				'script-src': [
					"'self'",
					"'unsafe-inline'",
					"'unsafe-eval'",
					'plausible.jaw.dev',
					'jaw.lol',
					'notify.jaw.dev',
				],
				'script-src-attr': ["'unsafe-inline'"],
			},
		},
		referrerPolicy: {
			policy: 'strict-origin-when-cross-origin',
		},
	});
}

export function sessionMiddleware() {
	return session({
		secret: sessionConfig.secret,
		resave: false,
		saveUninitialized: false,
		store: new connectRedisStore({
			client: redis,
			prefix: sessionConfig.store_prefix,
			disableTouch: true,
		}),
		proxy: appConfig.env === 'production',
		cookie: {
			path: '/',
			domain: `.${sessionConfig.domain}`,
			maxAge: 1000 * 60 * 60 * 24, // 24 hours
			httpOnly: appConfig.env === 'production',
			sameSite: 'lax',
			secure: appConfig.env === 'production',
		},
	});
}

export function rateLimitMiddleware() {
	return rateLimit({
		store: new rateLimitRedisStore({
			// @ts-expect-error - Known issue: the `call` function is not present in @types/ioredis
			sendCommand: (...args: string[]) => redis.call(...args),
		}),
		windowMs: 15 * 60 * 1000, // 15 minutes
		max: 100, // Limit each IP to 100 requests per windowMs
		standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
		legacyHeaders: false, // Disable the `X-RateLimit-*` headers
		handler: (req, res) => {
			if (req.get('Content-Type') === 'application/json') {
				return res.json({ message: 'Too many requests from this IP, please try again later.' });
			}
			return res.status(429).render('./rate-limit.html');
		},
		skip: (req: any, res: any) => appConfig.env !== 'production',
	});
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

		if (req.session?.user) {
			// TODO: potentially cache with redis
			// @ts-expect-error
			const { unread_apps_notification_count } = await db('notifications')
				.count('* as unread_apps_notification_count')
				.leftJoin('apps', 'notifications.app_id', 'apps.id')
				.where('apps.user_id', req.session?.user.id)
				.whereNull('notifications.read_at')
				.first();

			res.locals.state['unread_apps_notification_count'] = unread_apps_notification_count;

			const appIdMatch = req.path.match(/^\/apps\/(\d+)/);
			if (appIdMatch && req.method === 'GET') {
				// @ts-expect-error
				const appId = parseInt(appIdMatch[1]);

				// @ts-expect-error
				const { unread_app_notification_count } = await db('notifications')
					.count('* as unread_app_notification_count')
					.leftJoin('apps', 'notifications.app_id', 'apps.id')
					.where('apps.user_id', req.session?.user?.id)
					.andWhere({ 'apps.id': appId })
					.whereNull('notifications.read_at')
					.first();

				// @ts-expect-error
				const { active_channel_count } = await db('app_channels')
					.where({
						app_id: appId,
						is_active: true,
					})
					.count('* as active_channel_count')
					.first();

				res.locals.state['unread_app_notification_count'] = unread_app_notification_count;
				res.locals.state['active_channel_count'] = active_channel_count;
			}
		}

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
		if (appConfig.env !== 'production') {
			console.error(error);
		}

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
	) => Response | Promise<Response<any> | void> | void | Promise<void>,
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
