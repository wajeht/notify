import express from 'express';

import {
	adminOnlyMiddleware,
	apiKeyAuthenticationMiddleware,
	authenticationMiddleware,
	csrfMiddleware,
} from './middleware';

import {
	getHealthzHandler,
	postNotificationHandler,
	postExportAppChannelsHandler,
	getImportAppChannelsPageHandle,
	postImportAppChannelsConfigHandle,
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
	postMarkAllNotificationsAsReadHandler,
	postMarkAllUserNotificationsAsReadHandler,
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
	getSettingsDataPageHandler,
	getSettingsDangerZonePageHandler,
	postSettingsDataPageHandler,
	postDeleteSettingsDangerZoneHandler,
	postSettingsAccountHandler,
	getAdminPageHandler,
	getAdminUsersPageHandler,
	postUpdateAdminUsersHandler,
	postUpdateAdminUserAppsHandler,
} from './handler';

const router = express.Router();

router.get('/', getHomePageHandler);

router.get('/healthz', getHealthzHandler);

router.get('/terms-of-service', getTermsOfServicePageHandler);

router.get('/logout', getLogoutHandler);

router.post('/', apiKeyAuthenticationMiddleware, postNotificationHandler);

router.get('/settings', authenticationMiddleware, csrfMiddleware, getSettingsPageHandler);

router.get(
	'/admin',
	authenticationMiddleware,
	adminOnlyMiddleware,
	csrfMiddleware,
	getAdminPageHandler,
);

router.get(
	'/admin/users',
	authenticationMiddleware,
	adminOnlyMiddleware,
	csrfMiddleware,
	getAdminUsersPageHandler,
);

router.post(
	'/admin/users/:id',
	authenticationMiddleware,
	adminOnlyMiddleware,
	csrfMiddleware,
	postUpdateAdminUsersHandler,
);

router.post(
	'/admin/users/:uid/apps/:aid',
	authenticationMiddleware,
	adminOnlyMiddleware,
	csrfMiddleware,
	postUpdateAdminUserAppsHandler,
);

router.get(
	'/settings/account',
	authenticationMiddleware,
	csrfMiddleware,
	getSettingsAccountPageHandler,
);

router.get('/settings/data', authenticationMiddleware, csrfMiddleware, getSettingsDataPageHandler);

router.post(
	'/settings/data',
	authenticationMiddleware,
	csrfMiddleware,
	postSettingsDataPageHandler,
);

router.post(
	'/settings/account',
	authenticationMiddleware,
	csrfMiddleware,
	postSettingsAccountHandler,
);

router.get(
	'/settings/danger-zone',
	authenticationMiddleware,
	csrfMiddleware,
	getSettingsDangerZonePageHandler,
);

router.post(
	'/settings/danger-zone/delete',
	authenticationMiddleware,
	csrfMiddleware,
	postDeleteSettingsDangerZoneHandler,
);

router.get('/notifications', authenticationMiddleware, csrfMiddleware, getNotificationsPageHandler);

router.post(
	'/notifications/read',
	authenticationMiddleware,
	csrfMiddleware,
	postMarkAllUserNotificationsAsReadHandler,
);

router.get('/apps', authenticationMiddleware, csrfMiddleware, getAppsPageHandler);

router.post('/apps', authenticationMiddleware, csrfMiddleware, postCreateAppHandler);

router.get('/apps/create', authenticationMiddleware, csrfMiddleware, getCreateNewAppPageHandler);

router.get('/apps/:id', authenticationMiddleware, csrfMiddleware, getAppPageHandler);

router.get('/apps/:id/edit', authenticationMiddleware, csrfMiddleware, getAppEditPageHandler);

router.post('/apps/:id', authenticationMiddleware, csrfMiddleware, postAppUpdateHandler);

router.post('/apps/:id/delete', authenticationMiddleware, csrfMiddleware, postDeleteAppHandler);

router.get(
	'/apps/:id/channels',
	authenticationMiddleware,
	csrfMiddleware,
	getAppChannelsPageHandler,
);

router.get(
	'/apps/:id/channels/import',
	authenticationMiddleware,
	csrfMiddleware,
	getImportAppChannelsPageHandle,
);

router.post(
	'/apps/:id/channels/import',
	authenticationMiddleware,
	csrfMiddleware,
	postImportAppChannelsConfigHandle,
);

router.post(
	'/apps/:id/channels/export',
	authenticationMiddleware,
	csrfMiddleware,
	postExportAppChannelsHandler,
);

router.get(
	'/apps/:id/channels/create',
	authenticationMiddleware,
	csrfMiddleware,
	getNewAppChannelPageHandler,
);

router.post(
	'/apps/:id/channels/discord',
	authenticationMiddleware,
	csrfMiddleware,
	postCreateAppDiscordChannelConfigHandler,
);

router.post(
	'/apps/:id/create-api-key',
	authenticationMiddleware,
	csrfMiddleware,
	postCreateAppApiKeyHandler,
);

router.post(
	'/apps/:id/channels/sms',
	authenticationMiddleware,
	csrfMiddleware,
	postCreateAppSMSChannelConfigHandler,
);

router.post(
	'/apps/:id/channels/email',
	authenticationMiddleware,
	csrfMiddleware,
	postCreateAppEmailChannelConfigHandler,
);

router.post(
	'/apps/:aid/channels/:cid/delete',
	authenticationMiddleware,
	csrfMiddleware,
	postDeleteAppChannelHandler,
);

router.get(
	'/apps/:id/channels/:cid/configs/:cfid/edit',
	authenticationMiddleware,
	csrfMiddleware,
	getAppChannelEditPageHandler,
);

router.post(
	'/apps/:id/channels/:cid/configs/:cfid/sms',
	authenticationMiddleware,
	csrfMiddleware,
	postUpdateAppChannelSMSHandler,
);

router.post(
	'/apps/:id/channels/:cid/configs/:cfid/discord',
	authenticationMiddleware,
	csrfMiddleware,
	postUpdateAppChannelDiscordHandler,
);

router.post(
	'/apps/:id/channels/:cid/configs/:cfid/email',
	authenticationMiddleware,
	csrfMiddleware,
	postUpdateAppChannelEmailHandler,
);

router.get(
	'/apps/:id/notifications',
	authenticationMiddleware,
	csrfMiddleware,
	getAppNotificationsPageHandler,
);

router.get(
	'/apps/:id/settings',
	authenticationMiddleware,
	csrfMiddleware,
	getAppSettingsPageHandler,
);

router.post(
	'/apps/:id/notifications/:nid/delete',
	authenticationMiddleware,
	csrfMiddleware,
	postDeleteAppNotificationHandler,
);

router.post(
	'/apps/:aid/notifications/:nid/read',
	authenticationMiddleware,
	csrfMiddleware,
	postMarkNotificationAsReadHandler,
);

router.post(
	'/apps/:aid/notifications/read',
	authenticationMiddleware,
	csrfMiddleware,
	postMarkAllNotificationsAsReadHandler,
);

router.post(
	'/apps/:id/notifications/test',
	authenticationMiddleware,
	csrfMiddleware,
	postTestAppNotificationHandler,
);

router.get('/login', getLoginHandler);

router.get('/oauth/github', getGithub);

router.get('/oauth/github/redirect', getGithubRedirect);

export { router };
