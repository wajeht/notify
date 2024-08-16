import {
	getHealthzHandler,
	postNotificationHandler,
	getHomePageHandler,
	getAppsPageHandler,
	getJobsPageHandler,
	getAppEditPageHandler,
	postAppUpdateHandler,
	getNotificationsPageHandler,
	postCreateAppHandler,
	getNewAppChannelPageHandler,
	getAppPageHandler,
	getTermsOfServicePageHandler,
	getSettingsPageHandler,
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

router.post('/apps', catchAsyncErrorMiddleware(postCreateAppHandler));

router.get('/apps/create', catchAsyncErrorMiddleware(getCreateNewAppPageHandler));

router.get('/apps/:id', catchAsyncErrorMiddleware(getAppPageHandler));

router.get('/apps/:id/edit', catchAsyncErrorMiddleware(getAppEditPageHandler));

router.post('/apps/:id', catchAsyncErrorMiddleware(postAppUpdateHandler));

router.get('/apps/:id/channels', catchAsyncErrorMiddleware(getAppChannelsPageHandler));

router.get('/apps/:id/channels/create', catchAsyncErrorMiddleware(getNewAppChannelPageHandler));

router.get('/apps/:id/notifications', catchAsyncErrorMiddleware(getAppNotificationsPageHandler));

router.get('/settings', catchAsyncErrorMiddleware(getSettingsPageHandler));

router.get('/jobs', catchAsyncErrorMiddleware(getJobsPageHandler));

router.get('/notifications', catchAsyncErrorMiddleware(getNotificationsPageHandler));

router.get('/logout', catchAsyncErrorMiddleware(getLogoutHandler));

export { router };
