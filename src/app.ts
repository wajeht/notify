import ejs from 'ejs';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import express from 'express';
import { router } from './router';
import flash from 'connect-flash';
import { redis } from './db/redis';
import compression from 'compression';
import session from 'express-session';
import connectRedisStore from 'connect-redis';
import expressLayouts from 'express-ejs-layouts';
import rateLimit from 'express-rate-limit';
import rateLimitRedisStore from 'rate-limit-redis';

import { appConfig, sessionConfig } from './config';
import { appLocalStateMiddleware, errorMiddleware, notFoundMiddleware } from './middleware';

const app = express();

const redisStore = new connectRedisStore({
	client: redis,
	prefix: sessionConfig.store_prefix,
	disableTouch: true,
});

app.use(express.json({ limit: '100kb' }));

app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.use(
	session({
		secret: sessionConfig.secret,
		resave: false,
		saveUninitialized: false,
		store: redisStore,
		proxy: appConfig.env === 'production',
		cookie: {
			path: '/',
			domain: `.${sessionConfig.domain}`,
			maxAge: 1000 * 60 * 60 * 24, // 24 hours
			httpOnly: appConfig.env === 'production',
			sameSite: 'lax',
			secure: appConfig.env === 'production',
		},
	}),
);

app.set('trust proxy', 1);

app.use(flash());

app.use(
	helmet({
		contentSecurityPolicy: {
			useDefaults: true,
			directives: {
				...helmet.contentSecurityPolicy.getDefaultDirectives(),
				'default-src': ["'self'", 'plausible.jaw.dev'],
				'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'plausible.jaw.dev'],
				'script-src-attr': ["'unsafe-inline'"],
			},
		},
	}),
);

app.use(
	rateLimit({
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
	}),
);

app.use(cors());

app.use(compression());

app.use(express.static(path.resolve(path.join(process.cwd(), 'public')), { maxAge: '30d' }));

app.engine('html', ejs.renderFile);

app.set('view engine', 'html');

app.set('views', path.resolve(path.join(process.cwd(), 'src', 'views', 'pages')));

app.set('layout', path.resolve(path.join(process.cwd(), 'src', 'views', 'layouts', 'public.html')));

app.use(expressLayouts);

app.use(appLocalStateMiddleware);

app.use(router);

app.use(notFoundMiddleware());

app.use(errorMiddleware());

export { app };
