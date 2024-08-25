import { db } from './db/db';
import jwt from 'jsonwebtoken';
import { ApiKeyPayload, DiscordConfig, EmailConfig, SmsConfig } from './types';
import axios, { AxiosError } from 'axios';
import { HttpError, UnauthorizedError } from './error';
import { appConfig, oauthConfig } from './config';
import { NextFunction, Request, Response } from 'express';
import { sendNotificationJob } from './jobs/notification.job';
import { extractDomain, getGithubOauthToken, getGithubUserEmails, secret } from './utils';

// GET /healthz
export function getHealthzHandler(req: Request, res: Response) {
	return res.setHeader('Content-Type', 'text/html').status(200).send('<p>ok</p>');
}

// GET /terms-of-service
export function getTermsOfServicePageHandler(req: Request, res: Response) {
	return res.render('terms-of-service.html', {
		path: '/terms-of-service',
	});
}

// GET /
export function getHomePageHandler(req: Request, res: Response) {
	if (req.session?.user) {
		return res.redirect('/apps');
	}

	return res.render('home.html', {
		path: '/',
	});
}

// POST /
export async function postNotificationHandler(req: Request, res: Response) {
	if (req.get('Content-Type') !== 'application/json') {
		return res.status(404).json({ message: 'not found' });
	}

	const { appId, message, details } = req.body;

	await sendNotificationJob({ appId, message, details });

	return res.json({
		message: 'Notification queued successfully',
	});
}

// GET /settings
export async function getSettingsPageHandler(req: Request, res: Response) {
	const userId = req.session?.user?.id;
	const user = await db.select('*').from('users').where({ id: userId }).first();

	return res.render('settings-account.html', {
		user,
		path: '/settings',
		layout: '../layouts/settings.html',
	});
}

// GET /settings/account
export async function getSettingsAccountPageHandler(req: Request, res: Response) {
	const userId = req.session?.user?.id;
	const user = await db.select('*').from('users').where({ id: userId }).first();

	return res.render('settings-account.html', {
		user,
		path: '/settings/account',
		layout: '../layouts/settings.html',
	});
}

// POST /settings/account
export async function postSettingsAccountHandler(req: Request, res: Response) {
	const { email, username } = req.body;
	const userId = req.session?.user?.id;

	const [user] = await db('users')
		.update({
			email,
			username,
		})
		.where({ id: userId })
		.returning('*');

	return res.redirect('/settings/account?toast=🔄 updated!');
}

// GET /settings/danger-zone
export async function getSettingsDangerZonePageHandler(req: Request, res: Response) {
	const userId = req.session?.user?.id;
	const user = await db.select('*').from('users').where({ id: userId }).first();

	return res.render('settings-danger-zone.html', {
		user,
		path: '/settings/danger-zone',
		layout: '../layouts/settings.html',
	});
}

// POST /settings/danger-zone/delete
export async function postDeleteSettingsDangerZoneHandler(req: Request, res: Response) {
	const userId = req.session?.user?.id;

	await db('users').where({ id: userId }).delete();

	if (req.session && req.session?.user) {
		req.session.user = undefined;
		req.session.destroy((error) => {
			if (error) {
				throw HttpError(error);
			}
		});
	}

	return res.redirect('/?toast=🗑️ deleted');
}

// GET /notifications
export async function getNotificationsPageHandler(req: Request, res: Response) {
	const perPage = parseInt(req.query.perPage as string) || 10; // Number of items per page
	const currentPage = parseInt(req.query.page as string) || 1; // Current page number

	const result = await db('notifications')
		.orderBy('created_at', 'desc')
		.paginate({ perPage, currentPage, isLengthAware: true });

	return res.render('notifications.html', {
		notifications: result.data,
		pagination: result.pagination,
		path: '/notifications',
		layout: '../layouts/auth.html',
	});
}

// GET /apps
export async function getAppsPageHandler(req: Request, res: Response) {
	const filter = req.query.filter as string;
	const page = parseInt(req.query.page as string) || 1;
	const perPage = parseInt(req.query.perPage as string) || 10;

	let query = db
		.select(
			'apps.*',
			db.raw(
				'(SELECT COUNT(*) FROM app_channels WHERE app_channels.app_id = apps.id) as channel_count',
			),
			db.raw(
				'(SELECT COUNT(*) FROM notifications WHERE notifications.app_id = apps.id) as notification_count',
			),
		)
		.from('apps')
		.orderBy('apps.created_at', 'desc');

	if (filter === 'active') {
		query = query.where('apps.is_active', true);
	} else if (filter === 'inactive') {
		query = query.where('apps.is_active', false);
	}

	const { data: apps, pagination } = await query.paginate({
		perPage,
		currentPage: page,
		isLengthAware: true,
	});

	const path = filter ? `/apps?filter=${filter}` : '/apps';

	return res.render('apps.html', {
		apps,
		path,
		pagination,
		layout: '../layouts/auth.html',
	});
}

// GET /apps/:id
export async function getAppPageHandler(req: Request, res: Response) {
	const [app] = await db
		.select('*')
		.from('apps')
		.where({ id: parseInt(req.params.id!) });
	return res.render('apps-id.html', {
		app,
		layout: '../layouts/app.html',
		path: `/apps/${app.id}`,
	});
}

// POST /apps/:id/delete
export async function postDeleteAppHandler(req: Request, res: Response) {
	await db('apps').where({ id: req.params.id }).del();
	return res.redirect('/apps?toast=🗑️ deleted');
}

// POST /apps/:id
export async function postAppUpdateHandler(req: Request, res: Response, next: NextFunction) {
	const { name, url, description, user_monthly_limit_threshold } = req.body;

	const id = parseInt(req.params.id!);

	const is_active = req.body.is_active === 'on' ? true : false;

	await db('apps').where({ id }).update({
		is_active,
		name,
		user_monthly_limit_threshold,
		url,
		description,
		updated_at: db.fn.now(),
	});

	return res.redirect(`/apps/${id}?toast=🔄 updated`);
}

// POST /apps/:id/create-api-key
export async function postCreateAppApiKeyHandler(req: Request, res: Response) {
	const { id } = req.params;

	const app = await db('apps').where({ id }).first();

	const newKeyVersion = (app.api_key_version || 0) + 1;

	const payload: ApiKeyPayload = {
		appId: app.id,
		userId: app.user_id,
		apiKeyVersion: newKeyVersion,
	};

	const apiKey = jwt.sign(payload, appConfig.apiKeySecret, { expiresIn: '1y' });

	await db('apps').where({ id }).update({
		api_key: apiKey,
		api_key_version: newKeyVersion,
		api_key_created_at: db.fn.now(),
	});

	return res.redirect(`/apps/${id}?toast=🎉 created`);
}

// GET /apps/:id/edit
export async function getAppEditPageHandler(req: Request, res: Response) {
	const [app] = await db
		.select('*')
		.from('apps')
		.where({ id: parseInt(req.params.id!) });
	return res.render('apps-id-edit.html', {
		app,
		layout: '../layouts/app.html',
		path: `/apps/${app.id}`,
	});
}

// POST '/apps/:aid/channels/:cid/delete'
export async function postDeleteAppChannelHandler(req: Request, res: Response) {
	const { aid, cid } = req.params;

	await db('app_channels').where({ id: cid }).del();

	return res.redirect(`/apps/${aid}/channels?toast=🗑️ deleted`);
}

// POST '/apps/:id/notifications/:nid/delete'
export async function postDeleteAppNotificationHandler(req: Request, res: Response) {
	const { id, nid } = req.params;

	await db('notifications').where({ id: nid }).del();

	return res.redirect(`/apps/${id}/notifications?toast=🗑️ deleted`);
}

// POST '/apps/:id/notifications/test
export async function postTestAppNotificationHandler(req: Request, res: Response) {
	const { id } = req.params;

	const app = await db.select('api_key', 'id', 'is_active').from('apps').where({ id }).first();

	if (app.is_active === false) {
		return res.redirect(`/apps/${id}?toast=🚨 app is not active`);
	}

	if (app.api_key === null) {
		return res.redirect(`/apps/${id}?toast=🚨 please generate an api key first`);
	}

	try {
		await axios.post(
			extractDomain(req),
			{
				appId: app.id,
				message: 'test notification',
				details: {
					hello: 'world',
				},
			},
			{
				headers: {
					'Content-Type': 'application/json',
					'X-API-KEY': app.api_key,
				},
			},
		);
	} catch (error) {
		// @ts-ignore- trust me bro
		const message = (error as AxiosError).response?.data?.message;
		return res.redirect(`/apps/${id}?toast=${message}`);
	}

	return res.redirect(`/apps/${id}?toast=🎉 notification queued successfully`);
}

// GET '/apps/:aid/channels/:cid/configs/:cfid/edit'
export async function getAppChannelEditPageHandler(req: Request, res: Response) {
	const { id, cid, cfid } = req.params;

	const [app] = await db
		.select('*')
		.from('apps')
		.where({ id: parseInt(req.params.id!) });

	const channel = await db('app_channels')
		.select('app_channels.*', 'channel_types.name as channel_type_name')
		.leftJoin('channel_types', 'app_channels.channel_type_id', 'channel_types.id')
		.where({ 'app_channels.id': cid, 'app_channels.app_id': id })
		.first();

	let config = await db
		.select('*')
		.from(`${channel.channel_type_name}_configs`)
		.where({ id: cfid })
		.first();

	if (channel.channel_type_name === 'discord') {
		const webhook_url = secret().decrypt((config as DiscordConfig).webhook_url);
		config = {
			...config,
			webhook_url,
		} as DiscordConfig;
	}

	if (channel.channel_type_name === 'email') {
		const host = secret().decrypt((config as EmailConfig).host);
		const port = secret().decrypt((config as EmailConfig).port);
		const alias = secret().decrypt((config as EmailConfig).alias);
		const auth_email = secret().decrypt((config as EmailConfig).auth_email);
		const auth_pass = secret().decrypt((config as EmailConfig).auth_pass);
		config = {
			...config,
			host,
			port,
			alias,
			auth_email,
			auth_pass,
		} as DiscordConfig;
	}

	return res.render('apps-id-channels-id-edit.html', {
		app,
		channel,
		config,
		layout: '../layouts/app.html',
		path: `/apps/${id}/channels/${cid}/edit`,
	});
}

// POST '/apps/:aid/channels/:cid/configs/:cfid/sms'
export async function postUpdateAppChannelSMSHandler(req: Request, res: Response) {
	const { id, cfid } = req.params;

	const { name, is_active, account_sid, auth_token, from_phone_number, phone_number } = req.body;

	await db('sms_configs')
		.where({ id: cfid })
		.update({
			name,
			account_sid,
			auth_token,
			from_phone_number,
			phone_number,
			is_active: is_active === 'on',
			updated_at: db.fn.now(),
		});

	res.redirect(`/apps/${id}/channels?toast=🔄 updated`);
}

// POST '/apps/:aid/channels/:cid/configs/:cfid/discord'
export async function postUpdateAppChannelDiscordHandler(req: Request, res: Response) {
	const { id, cfid } = req.params;
	const { name, is_active, webhook_url } = req.body;

	const hashedWebhookUrl = secret().encrypt(webhook_url);

	await db('discord_configs')
		.where({ id: cfid })
		.update({
			webhook_url: hashedWebhookUrl,
			name,
			is_active: is_active === 'on',
			updated_at: db.fn.now(),
		});

	res.redirect(`/apps/${id}/channels?toast=🔄 updated`);
}

// POST '/apps/:aid/channels/:cid/configs/:cfid/email'
export async function postUpdateAppChannelEmailHandler(req: Request, res: Response) {
	const { id, cfid } = req.params;

	// eslint-disable-next-line prefer-const
	let { name, is_active, host, port, alias, auth_email, auth_pass } = req.body;

	host = secret().encrypt(host);
	port = secret().encrypt(port);
	alias = secret().encrypt(alias);
	auth_email = secret().encrypt(auth_email);
	auth_pass = secret().encrypt(auth_pass);

	await db('email_configs')
		.where({ id: cfid })
		.update({
			name,
			host,
			port,
			alias,
			auth_email,
			auth_pass,
			is_active: is_active === 'on',
			updated_at: db.fn.now(),
		});

	res.redirect(`/apps/${id}/channels?toast=🔄 updated`);
}

// GET /apps/:id/channels
export async function getAppChannelsPageHandler(req: Request, res: Response) {
	const app = await db
		.select(
			'apps.*',
			db.raw(`
    COALESCE(
      json_agg(
        json_build_object(
          'id', app_channels.id,
          'app_id', app_channels.app_id,
          'channel_type', channel_types.name,
          'config', CASE
            WHEN channel_types.name = 'email' THEN
              json_build_object(
                'id', email_configs.id,
                'name', email_configs.name,
                'is_active', email_configs.is_active,
                'host', email_configs.host,
                'port', email_configs.port,
                'alias', email_configs.alias,
                'auth_email', email_configs.auth_email,
                'auth_pass', email_configs.auth_pass,
                'created_at', email_configs.created_at,
                'updated_at', email_configs.updated_at
              )
            WHEN channel_types.name = 'sms' THEN
              json_build_object(
                'id', sms_configs.id,
                'name', sms_configs.name,
                'is_active', sms_configs.is_active,
                'account_sid', sms_configs.account_sid,
                'auth_token', sms_configs.auth_token,
                'from_phone_number', sms_configs.from_phone_number,
                'phone_number', sms_configs.phone_number,
                'created_at', sms_configs.created_at,
                'updated_at', sms_configs.updated_at
              )
            WHEN channel_types.name = 'discord' THEN
              json_build_object(
                'id', discord_configs.id,
                'name', discord_configs.name,
                'is_active', discord_configs.is_active,
                'webhook_url', discord_configs.webhook_url,
                'created_at', discord_configs.created_at,
                'updated_at', discord_configs.updated_at
              )
            ELSE NULL
          END
        )
        ORDER BY app_channels.created_at DESC
      ) FILTER (WHERE app_channels.id IS NOT NULL),
      '[]'
    ) as channels
  `),
		)
		.from('apps')
		.leftJoin('app_channels', 'apps.id', 'app_channels.app_id')
		.leftJoin('channel_types', 'app_channels.channel_type_id', 'channel_types.id')
		.leftJoin('email_configs', 'app_channels.id', 'email_configs.app_channel_id')
		.leftJoin('sms_configs', 'app_channels.id', 'sms_configs.app_channel_id')
		.leftJoin('discord_configs', 'app_channels.id', 'discord_configs.app_channel_id')
		.where('apps.id', req.params.id)
		.groupBy('apps.id')
		.first();

	return res.render('apps-id-channels.html', {
		app,
		layout: '../layouts/app.html',
		path: `/apps/${app.id}/channels`,
	});
}

// GET /apps/:id/channels/create
export async function getNewAppChannelPageHandler(req: Request, res: Response) {
	const [app] = await db
		.select('*')
		.from('apps')
		.where({ id: parseInt(req.params.id!) });
	return res.render('apps-id-channels-create.html', {
		app,
		layout: '../layouts/app.html',
		path: `/apps/${app.id}/channels/create`,
	});
}

// POST /apps/:id/channels/discord
export async function postCreateAppDiscordChannelConfigHandler(req: Request, res: Response) {
	const { id } = req.params;
	const { name, is_active, webhook_url } = req.body;

	const channel_type = await db
		.select('id')
		.from('channel_types')
		.where({ name: 'discord' })
		.first();

	const [app_channel] = await db('app_channels')
		.insert({
			app_id: id,
			channel_type_id: channel_type.id,
		})
		.returning('*');

	const hashedWebhookUrl = secret().encrypt(webhook_url);

	await db('discord_configs').insert({
		app_channel_id: app_channel.id,
		webhook_url: hashedWebhookUrl,
		name,
		is_active: is_active === 'on',
	});

	return res.redirect(`/apps/${id}/channels?toast=🎉 created`);
}

// POST /apps/:id/channels/sms
export async function postCreateAppSMSChannelConfigHandler(req: Request, res: Response) {
	const { id } = req.params;
	const { name, is_active, account_sid, auth_token, from_phone_number, phone_number } = req.body;

	const channel_type = await db.select('id').from('channel_types').where({ name: 'sms' }).first();

	const [app_channel] = await db('app_channels')
		.insert({
			app_id: id,
			channel_type_id: channel_type.id,
		})
		.returning('*');

	await db('sms_configs').insert({
		app_channel_id: app_channel.id,
		name,
		account_sid,
		auth_token,
		from_phone_number,
		phone_number,
		is_active: is_active === 'on',
	});

	return res.redirect(`/apps/${id}/channels?toast=🎉 created`);
}

// POST /apps/:id/channels/email
export async function postCreateAppEmailChannelConfigHandler(req: Request, res: Response) {
	const { id } = req.params;

	// eslint-disable-next-line prefer-const
	let { name, is_active, host, port, alias, auth_email, auth_pass } = req.body;

	const channel_type = await db.select('id').from('channel_types').where({ name: 'email' }).first();

	const [app_channel] = await db('app_channels')
		.insert({
			app_id: id,
			channel_type_id: channel_type.id,
		})
		.returning('*');

	host = secret().encrypt(host);
	port = secret().encrypt(port);
	alias = secret().encrypt(alias);
	auth_email = secret().encrypt(auth_email);
	auth_pass = secret().encrypt(auth_pass);

	await db('email_configs').insert({
		app_channel_id: app_channel.id,
		name,
		host,
		port,
		alias,
		auth_email,
		auth_pass,
		is_active: is_active === 'on',
	});

	return res.redirect(`/apps/${id}/channels?toast=🎉 created`);
}

// GET /apps/:id/settings
export async function getAppSettingsPageHandler(req: Request, res: Response) {
	const { id } = req.params;
	const app = await db.select('*').from('apps').where({ id }).first();
	return res.render('apps-id-settings.html', {
		app,
		layout: '../layouts/app.html',
		path: `/apps/${app.id}/settings`,
	});
}

// GET /apps/:id/notifications
export async function getAppNotificationsPageHandler(req: Request, res: Response) {
	const appId = req.params.id;
	const perPage = parseInt(req.query.perPage as string) || 10;
	const currentPage = parseInt(req.query.page as string) || 1;

	const app = await db.select('apps.*').from('apps').where('apps.id', appId).first();

	const result = await db('notifications')
		.where('app_id', appId)
		.orderBy('created_at', 'desc')
		.paginate({ perPage, currentPage, isLengthAware: true });

	const notifications = {
		...app,
		notifications: result.data,
	};

	return res.render('apps-id-notifications.html', {
		app: notifications,
		pagination: result.pagination,
		layout: '../layouts/app.html',
		path: `/apps/${appId}/notifications`,
	});
}

// GET /apps/create
export async function getCreateNewAppPageHandler(req: Request, res: Response) {
	return res.render('apps-create.html', {
		layout: '../layouts/auth.html',
		path: '/apps/create',
	});
}

// POST /apps
export async function postCreateAppHandler(req: Request, res: Response) {
	const { name, is_active, description, url } = req.body;
	const userId = req.session?.user?.id;

	const [app] = await db('apps')
		.insert({
			user_id: userId,
			name,
			url,
			description,
			is_active: is_active === 'on',
		})
		.returning('*');

	return res.redirect(`/apps/${app.id}?toast=🎉 created`);
}

// GET /logout
export function getLogoutHandler(req: Request, res: Response) {
	if (req.session && req.session?.user) {
		req.session.user = undefined;
		req.session.destroy((error) => {
			if (error) {
				throw HttpError(error);
			}
		});
	}

	return res.redirect('/');
}

// GET /login
export function getLoginHandler(req: Request, res: Response) {
	if (req.session?.user) {
		return res.redirect('/apps');
	}

	return res.redirect('/oauth/github');
}

// GET /oauth/github
export async function getGithub(req: Request, res: Response) {
	if (req.session?.user) {
		return res.redirect('/apps');
	}

	const rootUrl = 'https://github.com/login/oauth/authorize';

	const qs = new URLSearchParams({
		redirect_uri: oauthConfig.github.redirect_uri,
		client_id: oauthConfig.github.client_id,
		scope: 'user:email',
	});

	return res.redirect(`${rootUrl}?${qs.toString()}`);
}

// GET /oauth/github/redirect
export async function getGithubRedirect(req: Request, res: Response) {
	const code = req.query.code as string;

	if (!code) {
		throw UnauthorizedError('Something went wrong while authenticating with github');
	}

	const { access_token } = await getGithubOauthToken(code);

	const emails = await getGithubUserEmails(access_token);

	const email = emails.filter((email) => email.primary && email.verified)[0]?.email;

	let foundUser = await db.select('*').from('users').where({ email }).first();

	if (!foundUser) {
		[foundUser] = await db('users')
			.insert({
				username: email?.split('@')[0],
				email,
				is_admin: appConfig.adminEmail === email,
			})
			.returning('*');
	}

	req.session.user = foundUser;
	req.session.save();

	res.redirect('/apps');
}
