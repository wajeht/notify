import ejs from 'ejs';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import session from 'express-session';
import express from 'express';
import { router } from './router';
import compression from 'compression';
import expressLayouts from 'express-ejs-layouts';
import { appLocalStateMiddleware, errorMiddleware, notFoundMiddleware } from './middleware';
import { appConfig, sessionConfig } from './config';
import RedisStore from 'connect-redis';
import { redis } from './db/redis';

const app = express();

const redisStore = new RedisStore({
	client: redis,
	prefix: sessionConfig.store_prefix,
	disableTouch: true,
});

app.use(express.json({ limit: '1mb' }));

app.use(express.urlencoded({ extended: true }));

app.set('trust proxy', 1);

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

app.use(
	helmet.contentSecurityPolicy({
		directives: {
			...helmet.contentSecurityPolicy.getDefaultDirectives(),
			'default-src': ["'self'", 'plausible.jaw.dev'],
			'script-src': ["'self'", "'unsafe-inline'", 'plausible.jaw.dev'],
			'script-src-attr': ["'unsafe-inline'"],
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
