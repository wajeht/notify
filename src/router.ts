import express from 'express';

import {
	csrfMiddleware,
	adminOnlyMiddleware,
	authenticationMiddleware,
	apiKeyAuthenticationMiddleware,
} from './middleware';

import {
	getGithub,
	getLoginHandler,
	getGithubRedirect,
	getLogoutHandler,
	getHealthzHandler,
	postAppUpdateHandler,
	getAdminPageHandler,
	getHomePageHandler,
	getAppsPageHandler,
	getAppPageHandler,
	postCreateAppHandler,
	getAppEditPageHandler,
	postDeleteAppHandler,
	getSettingsPageHandler,
	postNotificationHandler,
	getCreateNewAppPageHandler,
	getAppChannelsPageHandler,
	getTermsOfServicePageHandler,
	getNewAppChannelPageHandler,
	getAdminUsersPageHandler,
	getAppSettingsPageHandler,
	postCreateAppApiKeyHandler,
	getSettingsDataPageHandler,
	postSettingsDataPageHandler,
	postSettingsAccountHandler,
	postUpdateAdminUsersHandler,
	getSettingsAccountPageHandler,
	postImportSettingsDataHandler,
	getAppNotificationsPageHandler,
	postTestAppNotificationHandler,
	postUpdateAdminUserAppsHandler,
	postExportAppChannelsHandler,
	getImportAppChannelsPageHandle,
	postDeleteAppChannelHandler,
	getAppChannelEditPageHandler,
	postUpdateAppChannelSMSHandler,
	getNotificationsPageHandler,
	postImportAppChannelsConfigHandle,
	postMarkNotificationAsReadHandler,
	postDeleteAppNotificationHandler,
	getSettingsDangerZonePageHandler,
	postUpdateAppChannelEmailHandler,
	postUpdateAppChannelDiscordHandler,
	postDeleteSettingsDangerZoneHandler,
	postMarkAllNotificationsAsReadHandler,
	postCreateAppEmailChannelConfigHandler,
	postCreateAppDiscordChannelConfigHandler,
	postCreateAppSMSChannelConfigHandler,
	postMarkAllUserNotificationsAsReadHandler,
} from './handler';

const router = express.Router();

router.get('/', getHomePageHandler);
router.get('/healthz', getHealthzHandler);
router.get('/logout', getLogoutHandler);
router.get('/login', getLoginHandler);
router.get('/oauth/github', getGithub);
router.get('/oauth/github/redirect', getGithubRedirect);
router.get('/terms-of-service', getTermsOfServicePageHandler);
router.post('/', apiKeyAuthenticationMiddleware, postNotificationHandler);
router.get('/settings', authenticationMiddleware, csrfMiddleware, getSettingsPageHandler);

router.get('/admin', authenticationMiddleware, adminOnlyMiddleware, csrfMiddleware, getAdminPageHandler); // prettier-ignore
router.get('/admin/users', authenticationMiddleware, adminOnlyMiddleware, csrfMiddleware, getAdminUsersPageHandler); // prettier-ignore
router.post('/admin/users/:id', authenticationMiddleware, adminOnlyMiddleware, csrfMiddleware, postUpdateAdminUsersHandler); // prettier-ignore
router.post('/admin/users/:uid/apps/:aid', authenticationMiddleware, adminOnlyMiddleware, csrfMiddleware, postUpdateAdminUserAppsHandler); // prettier-ignore

router.get('/settings/account', authenticationMiddleware, csrfMiddleware, getSettingsAccountPageHandler); // prettier-ignore
router.get('/settings/data', authenticationMiddleware, csrfMiddleware, getSettingsDataPageHandler);
router.post('/settings/data', authenticationMiddleware, csrfMiddleware, postSettingsDataPageHandler); // prettier-ignore
router.post('/settings/account', authenticationMiddleware, csrfMiddleware, postSettingsAccountHandler); // prettier-ignore

router.get('/settings/danger-zone', authenticationMiddleware, csrfMiddleware, getSettingsDangerZonePageHandler); // prettier-ignore
router.post('/settings/danger-zone/delete', authenticationMiddleware, csrfMiddleware, postDeleteSettingsDangerZoneHandler); // prettier-ignore

router.get('/notifications', authenticationMiddleware, csrfMiddleware, getNotificationsPageHandler); // prettier-ignore
router.post('/notifications/read', authenticationMiddleware, csrfMiddleware, postMarkAllUserNotificationsAsReadHandler); // prettier-ignore

router.get('/apps', authenticationMiddleware, csrfMiddleware, getAppsPageHandler);
router.post('/apps', authenticationMiddleware, csrfMiddleware, postCreateAppHandler);
router.get('/apps/create', authenticationMiddleware, csrfMiddleware, getCreateNewAppPageHandler);
router.get('/apps/:id', authenticationMiddleware, csrfMiddleware, getAppPageHandler);
router.get('/apps/:id/edit', authenticationMiddleware, csrfMiddleware, getAppEditPageHandler);
router.post('/apps/:id', authenticationMiddleware, csrfMiddleware, postAppUpdateHandler);
router.post('/apps/:id/delete', authenticationMiddleware, csrfMiddleware, postDeleteAppHandler);

router.post('/apps/:id/create-api-key', authenticationMiddleware, csrfMiddleware, postCreateAppApiKeyHandler); // prettier-ignore
router.get('/apps/:id/channels', authenticationMiddleware, csrfMiddleware, getAppChannelsPageHandler); // prettier-ignore
router.get(
	'/apps/:id/channels/import',
	authenticationMiddleware,
	csrfMiddleware,
	getImportAppChannelsPageHandle,
);
router.post('/apps/:id/channels/import', authenticationMiddleware, csrfMiddleware, postImportAppChannelsConfigHandle); // prettier-ignore
router.post('/apps/:id/channels/export', authenticationMiddleware, csrfMiddleware, postExportAppChannelsHandler); // prettier-ignore
router.get('/apps/:id/channels/create', authenticationMiddleware, csrfMiddleware, getNewAppChannelPageHandler); // prettier-ignore

router.post('/apps/:id/channels/discord', authenticationMiddleware, csrfMiddleware, postCreateAppDiscordChannelConfigHandler); // prettier-ignore
router.post('/apps/:id/channels/sms', authenticationMiddleware, csrfMiddleware, postCreateAppSMSChannelConfigHandler); // prettier-ignore
router.post('/apps/:id/channels/email', authenticationMiddleware, csrfMiddleware, postCreateAppEmailChannelConfigHandler); // prettier-ignore

router.post('/apps/:aid/channels/:cid/delete', authenticationMiddleware, csrfMiddleware, postDeleteAppChannelHandler); // prettier-ignore

router.get('/apps/:id/channels/:cid/configs/:cfid/edit', authenticationMiddleware, csrfMiddleware, getAppChannelEditPageHandler); // prettier-ignore
router.post('/apps/:id/channels/:cid/configs/:cfid/sms', authenticationMiddleware, csrfMiddleware, postUpdateAppChannelSMSHandler); // prettier-ignore
router.post('/apps/:id/channels/:cid/configs/:cfid/discord', authenticationMiddleware, csrfMiddleware, postUpdateAppChannelDiscordHandler); // prettier-ignore
router.post('/apps/:id/channels/:cid/configs/:cfid/email', authenticationMiddleware, csrfMiddleware, postUpdateAppChannelEmailHandler); // prettier-ignore

router.get('/apps/:id/settings', authenticationMiddleware, csrfMiddleware, getAppSettingsPageHandler); // prettier-ignore

router.get('/apps/:id/notifications', authenticationMiddleware, csrfMiddleware, getAppNotificationsPageHandler); // prettier-ignore
router.post('/apps/:id/notifications/:nid/delete', authenticationMiddleware, csrfMiddleware, postDeleteAppNotificationHandler); // prettier-ignore
router.post('/apps/:aid/notifications/:nid/read', authenticationMiddleware, csrfMiddleware, postMarkNotificationAsReadHandler); // prettier-ignore
router.post('/apps/:aid/notifications/read', authenticationMiddleware, csrfMiddleware, postMarkAllNotificationsAsReadHandler); // prettier-ignore
router.post(
	'/apps/:id/notifications/test',
	authenticationMiddleware,
	csrfMiddleware,
	postTestAppNotificationHandler,
);

router.post(
	'/settings/data/import',
	authenticationMiddleware,
	csrfMiddleware,
	postImportSettingsDataHandler,
);

export { router };
