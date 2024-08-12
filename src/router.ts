import {
	getHealthzHandler,
	postNotificationHandler,
	getHomePageHandler,
	getDashboardPageHandler,
	getTermsOfServicePageHandler,
	getSettingsPageHandler,
	getProfilePageHandler,
	getLogoutHandler,
} from './handler';

import express from 'express';

import { catchAsyncErrorMiddleware } from './middleware';

const router = express.Router();

router.get('/', catchAsyncErrorMiddleware(getHomePageHandler));

router.post('/', catchAsyncErrorMiddleware(postNotificationHandler));

router.get('/terms-of-service', catchAsyncErrorMiddleware(getTermsOfServicePageHandler));

router.get('/healthz', catchAsyncErrorMiddleware(getHealthzHandler));

router.get('/dashboard', catchAsyncErrorMiddleware(getDashboardPageHandler));

router.get('/settings', catchAsyncErrorMiddleware(getSettingsPageHandler));

router.get('/profile', catchAsyncErrorMiddleware(getProfilePageHandler));

router.get('/logout', catchAsyncErrorMiddleware(getLogoutHandler));

export { router };
