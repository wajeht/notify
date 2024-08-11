import {
	getHealthzHandler,
	postNotificationHandler,
	getHomePageHandler,
	getDashboardPageHandler,
	getTermsOfServicePageHandler,
} from './handler';

import express from 'express';

import { catchAsyncErrorMiddleware } from '../middleware';

const router = express.Router();

router.get('/', catchAsyncErrorMiddleware(getHomePageHandler));

router.post('/', catchAsyncErrorMiddleware(postNotificationHandler));

router.get('/terms-of-service', catchAsyncErrorMiddleware(getTermsOfServicePageHandler));

router.get('/healthz', catchAsyncErrorMiddleware(getHealthzHandler));

router.get('/dashboard', catchAsyncErrorMiddleware(getDashboardPageHandler));

export { router };
