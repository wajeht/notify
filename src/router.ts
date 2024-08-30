import express from 'express';

import {
	apiKeyAuthenticationMiddleware,
	authenticationMiddleware,
	catchAsyncErrorMiddleware,
	csrfMiddleware,
	validateRequestMiddleware,
} from './middleware';

import {
	getHealthzHandler,
	postNotificationHandler,
	postExportAppChannelsHandler,
	getImportAppChannelsPageHandle,
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
	postMarkNotificationAsReadHandler,
	postCreateAppEmailChannelConfigHandler,
	postDeleteAppChannelHandler,
	getAppChannelEditPageHandler,
	postUpdateAppChannelSMSHandler,
	postUpdateAppChannelDiscordHandler,
	postUpdateAppChannelEmailHandler,
	getNotificationsPageHandler,
	getAppNotificationsPageHandler,
	getAppSettingsPageHandler,
	postDeleteAppNotificationHandler,
	getGithub,
	getGithubRedirect,
	getLoginHandler,
	postCreateAppApiKeyHandler,
	postTestAppNotificationHandler,
	getSettingsAccountPageHandler,
	getSettingsDangerZonePageHandler,
	postDeleteSettingsDangerZoneHandler,
	postSettingsAccountHandler,
} from './handler';

import { postSettingsAccountHandlerValidator } from './validator';

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
	csrfMiddleware,
	catchAsyncErrorMiddleware(getSettingsPageHandler),
);

router.get(
	'/settings/account',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(getSettingsAccountPageHandler),
);

router.post(
	'/settings/account',
	authenticationMiddleware,
	csrfMiddleware,
	validateRequestMiddleware(postSettingsAccountHandlerValidator),
	catchAsyncErrorMiddleware(postSettingsAccountHandler),
);

router.get(
	'/settings/danger-zone',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(getSettingsDangerZonePageHandler),
);

router.post(
	'/settings/danger-zone/delete',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(postDeleteSettingsDangerZoneHandler),
);

router.get(
	'/notifications',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(getNotificationsPageHandler),
);

router.get(
	'/apps',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(getAppsPageHandler),
);

router.post(
	'/apps',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(postCreateAppHandler),
);

router.get(
	'/apps/create',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(getCreateNewAppPageHandler),
);

router.get(
	'/apps/:id',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(getAppPageHandler),
);

router.get(
	'/apps/:id/edit',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(getAppEditPageHandler),
);

router.post(
	'/apps/:id',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(postAppUpdateHandler),
);

router.post(
	'/apps/:id/delete',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(postDeleteAppHandler),
);

router.get(
	'/apps/:id/channels',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(getAppChannelsPageHandler),
);

router.get(
	'/apps/:id/channels/import',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(getImportAppChannelsPageHandle),
);

router.post(
	'/apps/:id/channels/export',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(postExportAppChannelsHandler),
);

router.get(
	'/apps/:id/channels/create',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(getNewAppChannelPageHandler),
);

router.post(
	'/apps/:id/channels/discord',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(postCreateAppDiscordChannelConfigHandler),
);

router.post(
	'/apps/:id/create-api-key',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(postCreateAppApiKeyHandler),
);

router.post(
	'/apps/:id/channels/sms',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(postCreateAppSMSChannelConfigHandler),
);

router.post(
	'/apps/:id/channels/email',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(postCreateAppEmailChannelConfigHandler),
);

router.post(
	'/apps/:aid/channels/:cid/delete',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(postDeleteAppChannelHandler),
);

router.get(
	'/apps/:id/channels/:cid/configs/:cfid/edit',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(getAppChannelEditPageHandler),
);

router.post(
	'/apps/:id/channels/:cid/configs/:cfid/sms',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(postUpdateAppChannelSMSHandler),
);

router.post(
	'/apps/:id/channels/:cid/configs/:cfid/discord',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(postUpdateAppChannelDiscordHandler),
);

router.post(
	'/apps/:id/channels/:cid/configs/:cfid/email',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(postUpdateAppChannelEmailHandler),
);

router.get(
	'/apps/:id/notifications',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(getAppNotificationsPageHandler),
);

router.get(
	'/apps/:id/settings',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(getAppSettingsPageHandler),
);

router.post(
	'/apps/:id/notifications/:nid/delete',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(postDeleteAppNotificationHandler),
);

router.post(
	'/apps/:aid/notifications/:nid/read',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(postMarkNotificationAsReadHandler),
);

router.post(
	'/apps/:id/notifications/test',
	authenticationMiddleware,
	csrfMiddleware,
	catchAsyncErrorMiddleware(postTestAppNotificationHandler),
);

router.get('/login', catchAsyncErrorMiddleware(getLoginHandler));

router.get('/oauth/github', catchAsyncErrorMiddleware(getGithub));

router.get('/oauth/github/redirect', catchAsyncErrorMiddleware(getGithubRedirect));

export { router };
