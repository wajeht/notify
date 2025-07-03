import {
	errorMiddleware,
	helmetMiddleware,
	sessionMiddleware,
	notFoundMiddleware,
	rateLimitMiddleware,
	appLocalStateMiddleware,
} from './middleware';
import ejs from 'ejs';
import cors from 'cors';
import express from 'express';
import flash from 'connect-flash';
import { router } from './router';
import { appConfig } from './config';
import compression from 'compression';
import expressLayouts from 'express-ejs-layouts';
import { expressTemplatesReload } from '@wajeht/express-templates-reload';

const app = express();

if (appConfig.env === 'development') {
	expressTemplatesReload({
		app,
		watch: [{ path: './public/style.css' }, { path: './src/views', extensions: ['.html'] }],
		options: { quiet: false },
	});
}

app
	.set('trust proxy', 1)
	.use(sessionMiddleware())
	.use(flash())
	.use(compression())
	.use(cors())
	.use(helmetMiddleware())
	.use(rateLimitMiddleware())
	.use(express.json({ limit: '100kb' }))
	.use(express.urlencoded({ extended: true, limit: '100kb' }))
	.use(express.static('./public', { maxAge: '30d', etag: true, lastModified: true }))
	.engine('html', ejs.renderFile)
	.set('view engine', 'html')
	.set('view cache', appConfig.env === 'production')
	.set('views', './src/views/pages')
	.set('layout', '../layouts/public.html')
	.use(expressLayouts)
	.use(appLocalStateMiddleware)
	.use(router)
	.use(notFoundMiddleware())
	.use(errorMiddleware());

export { app };
