import {
	getHealthzHandler,
	postNotificationHandler,
	getHomePageHandler,
	getAppsPageHandler,
	getAppPageHandler,
	getTermsOfServicePageHandler,
	getSettingsPageHandler,
	getProfilePageHandler,
	getLogoutHandler,
	getCreateNewAppPageHandler,
	getAppNotificationsPageHandler,
	getAppChannelsPageHandler,
} from './handler';

import express from 'express';

import { catchAsyncErrorMiddleware } from './middleware';

const router = express.Router();

router.get('/', catchAsyncErrorMiddleware(getHomePageHandler));

router.post('/', catchAsyncErrorMiddleware(postNotificationHandler));

router.get('/terms-of-service', catchAsyncErrorMiddleware(getTermsOfServicePageHandler));

router.get('/healthz', catchAsyncErrorMiddleware(getHealthzHandler));

router.get('/apps', catchAsyncErrorMiddleware(getAppsPageHandler));

router.get('/apps/create', catchAsyncErrorMiddleware(getCreateNewAppPageHandler));

router.get('/apps/:id', catchAsyncErrorMiddleware(getAppPageHandler));

router.get('/apps/:id/channels', catchAsyncErrorMiddleware(getAppChannelsPageHandler));

router.get('/apps/:id/notifications', catchAsyncErrorMiddleware(getAppNotificationsPageHandler));

router.get('/settings', catchAsyncErrorMiddleware(getSettingsPageHandler));

router.get('/profile', catchAsyncErrorMiddleware(getProfilePageHandler));

router.get('/logout', catchAsyncErrorMiddleware(getLogoutHandler));

export { router };
