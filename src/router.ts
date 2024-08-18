import express from 'express';
import {
	apiKeyAuthenticationMiddleware,
	authenticationMiddleware,
	catchAsyncErrorMiddleware,
} from './middleware';
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
	getLoginHandler,
	postCreateAppApiKeyHandler,
} from './handler';

const router = express.Router();

router.get('/', catchAsyncErrorMiddleware(getHomePageHandler));

router.get('/healthz', catchAsyncErrorMiddleware(getHealthzHandler));

router.get('/terms-of-service', catchAsyncErrorMiddleware(getTermsOfServicePageHandler));

router.get('/logout', catchAsyncErrorMiddleware(getLogoutHandler));

router.post(
	'/',
	apiKeyAuthenticationMiddleware,
	catchAsyncErrorMiddleware(postNotificationHandler),
);

router.get(
	'/settings',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(getSettingsPageHandler),
);

router.get(
	'/notifications',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(getNotificationsPageHandler),
);

router.get('/apps', authenticationMiddleware, catchAsyncErrorMiddleware(getAppsPageHandler));

router.post('/apps', authenticationMiddleware, catchAsyncErrorMiddleware(postCreateAppHandler));

router.get(
	'/apps/create',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(getCreateNewAppPageHandler),
);

router.get('/apps/:id', authenticationMiddleware, catchAsyncErrorMiddleware(getAppPageHandler));

router.get(
	'/apps/:id/edit',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(getAppEditPageHandler),
);

router.post('/apps/:id', authenticationMiddleware, catchAsyncErrorMiddleware(postAppUpdateHandler));

router.post(
	'/apps/:id/delete',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(postDeleteAppHandler),
);

router.get(
	'/apps/:id/channels',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(getAppChannelsPageHandler),
);

router.get(
	'/apps/:id/channels/create',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(getNewAppChannelPageHandler),
);

router.post(
	'/apps/:id/channels/discord',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(postCreateAppDiscordChannelConfigHandler),
);

router.post(
	'/apps/:id/create-api-key',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(postCreateAppApiKeyHandler),
);

router.post(
	'/apps/:id/channels/sms',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(postCreateAppSMSChannelConfigHandler),
);

router.post(
	'/apps/:id/channels/email',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(postCreateAppEmailChannelConfigHandler),
);

router.post(
	'/apps/:aid/channels/:cid/delete',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(postDeleteAppChannelHandler),
);

router.get(
	'/apps/:id/channels/:cid/configs/:cfid/edit',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(getAppChannelEditPageHandler),
);

router.post(
	'/apps/:id/channels/:cid/configs/:cfid/sms',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(postUpdateAppChannelSMSHandler),
);

router.post(
	'/apps/:id/channels/:cid/configs/:cfid/discord',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(postUpdateAppChannelDiscordHandler),
);

router.post(
	'/apps/:id/channels/:cid/configs/:cfid/email',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(postUpdateAppChannelEmailHandler),
);

router.get(
	'/apps/:id/notifications',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(getAppNotificationsPageHandler),
);

router.post(
	'/apps/:id/notifications/:nid/delete',
	authenticationMiddleware,
	catchAsyncErrorMiddleware(postDeleteAppNotificationHandler),
);

router.get('/jobs', authenticationMiddleware, catchAsyncErrorMiddleware(getJobsPageHandler));

router.get('/login', catchAsyncErrorMiddleware(getLoginHandler));

router.get('/oauth/github', catchAsyncErrorMiddleware(getGithub));

router.get('/oauth/github/redirect', catchAsyncErrorMiddleware(getGithubRedirect));

export { router };
