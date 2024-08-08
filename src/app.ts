import ejs from 'ejs';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import express from 'express';
import { router } from './views/router';
import compression from 'compression';
import expressLayouts from 'express-ejs-layouts';
import { errorMiddleware, notFoundMiddleware } from './middleware';

const app = express();

app.use(express.json({ limit: '1mb' }));

app.use(express.urlencoded({ extended: true }));

app.use(
	helmet.contentSecurityPolicy({
		directives: {
			...helmet.contentSecurityPolicy.getDefaultDirectives(),
			'default-src': ["'self'", 'plausible.jaw.dev'],
			'script-src': ["'self'", "'unsafe-inline'", 'plausible.jaw.dev'],
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

app.use(router);

app.use(notFoundMiddleware());

app.use(errorMiddleware());

export { app };
