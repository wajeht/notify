import express from 'express';
import { catchAsyncErrorMiddleware } from './middleware';
import {
	getHealthzHandler,
	postNotificationHandler,
	getHomePageHandler,
	getTermsOfServicePageHandler,
	getSettingsPageHandler,
	getLogoutHandler,
	getAppsPageHandler,
	getCreateNewAppPageHandler,
	postCreateAppHandler,
	getAppPageHandler,
	getAppEditPageHandler,
	postAppUpdateHandler,
	postDeleteAppHandler,
	getAppChannelsPageHandler,
	getNewAppChannelPageHandler,
	postCreateAppDiscordChannelConfigHandler,
	postCreateAppSMSChannelConfigHandler,
	postCreateAppEmailChannelConfigHandler,
	postDeleteAppChannelHandler,
	getAppChannelEditPageHandler,
	postUpdateAppChannelSMSHandler,
	postUpdateAppChannelDiscordHandler,
	postUpdateAppChannelEmailHandler,
	getNotificationsPageHandler,
	getAppNotificationsPageHandler,
	postDeleteAppNotificationHandler,
	getJobsPageHandler,
	getGithub,
	getGithubRedirect,
} from './handler';

const router = express.Router();

router.get('/', catchAsyncErrorMiddleware(getHomePageHandler));

router.get('/healthz', catchAsyncErrorMiddleware(getHealthzHandler));

router.get('/terms-of-service', catchAsyncErrorMiddleware(getTermsOfServicePageHandler));

router.get('/settings', catchAsyncErrorMiddleware(getSettingsPageHandler));

router.get('/logout', catchAsyncErrorMiddleware(getLogoutHandler));

router.post('/', catchAsyncErrorMiddleware(postNotificationHandler));

router.get('/notifications', catchAsyncErrorMiddleware(getNotificationsPageHandler));

router.get('/apps', catchAsyncErrorMiddleware(getAppsPageHandler));

router.post('/apps', catchAsyncErrorMiddleware(postCreateAppHandler));

router.get('/apps/create', catchAsyncErrorMiddleware(getCreateNewAppPageHandler));

router.get('/apps/:id', catchAsyncErrorMiddleware(getAppPageHandler));

router.get('/apps/:id/edit', catchAsyncErrorMiddleware(getAppEditPageHandler));

router.post('/apps/:id', catchAsyncErrorMiddleware(postAppUpdateHandler));

router.post('/apps/:id/delete', catchAsyncErrorMiddleware(postDeleteAppHandler));

router.get('/apps/:id/channels', catchAsyncErrorMiddleware(getAppChannelsPageHandler));

router.get('/apps/:id/channels/create', catchAsyncErrorMiddleware(getNewAppChannelPageHandler));

router.post(
	'/apps/:id/channels/discord',
	catchAsyncErrorMiddleware(postCreateAppDiscordChannelConfigHandler),
);

router.post(
	'/apps/:id/channels/sms',
	catchAsyncErrorMiddleware(postCreateAppSMSChannelConfigHandler),
);

router.post(
	'/apps/:id/channels/email',
	catchAsyncErrorMiddleware(postCreateAppEmailChannelConfigHandler),
);

router.post(
	'/apps/:aid/channels/:cid/delete',
	catchAsyncErrorMiddleware(postDeleteAppChannelHandler),
);

router.get(
	'/apps/:id/channels/:cid/configs/:cfid/edit',
	catchAsyncErrorMiddleware(getAppChannelEditPageHandler),
);

router.post(
	'/apps/:id/channels/:cid/configs/:cfid/sms',
	catchAsyncErrorMiddleware(postUpdateAppChannelSMSHandler),
);

router.post(
	'/apps/:id/channels/:cid/configs/:cfid/discord',
	catchAsyncErrorMiddleware(postUpdateAppChannelDiscordHandler),
);

router.post(
	'/apps/:id/channels/:cid/configs/:cfid/email',
	catchAsyncErrorMiddleware(postUpdateAppChannelEmailHandler),
);

router.get('/apps/:id/notifications', catchAsyncErrorMiddleware(getAppNotificationsPageHandler));

router.post(
	'/apps/:id/notifications/:nid/delete',
	catchAsyncErrorMiddleware(postDeleteAppNotificationHandler),
);

router.get('/jobs', catchAsyncErrorMiddleware(getJobsPageHandler));

router.get('/oauth/github', catchAsyncErrorMiddleware(getGithub));

router.get('/oauth/github/redirect', catchAsyncErrorMiddleware(getGithubRedirect));

export { router };
