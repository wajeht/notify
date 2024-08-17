import { UnauthorizedError } from './error';
import { oauthConfig } from './config';
import { db } from './db/db';
import { Request, Response } from 'express';
import { getGithubOauthToken, getGithubUserEmails } from './utils';

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
	return res.render('home.html', {
		path: '/',
	});
}

// POST /
export function postNotificationHandler(req: Request, res: Response) {
	if (req.get('Content-Type') !== 'application/json') {
		return res.status(404).json({ message: 'not found' });
	}

	return res.json({
		success: true,
		message: 'Notification created and queued successfully',
		notificationId: 'generated_uuid',
		jobId: 'generated_job_id',
		channels: ['email', 'sms'],
	});
}

// GET /settings
export function getSettingsPageHandler(req: Request, res: Response) {
	return res.render('settings.html', {
		path: '/settings',
		layout: '../layouts/settings.html',
	});
}

// GET /notifications
export async function getNotificationsPageHandler(req: Request, res: Response) {
	const notifications = await db.select('*').from('notifications').orderBy('created_at', 'desc');
	return res.render('notifications.html', {
		notifications,
		path: '/notifications',
		layout: '../layouts/auth.html',
	});
}

// GET /jobs
export async function getJobsPageHandler(req: Request, res: Response) {
	const jobs = await db.select('*').from('jobs').orderBy('created_at', 'desc');
	return res.render('jobs.html', {
		jobs,
		path: '/jobs',
		layout: '../layouts/auth.html',
	});
}

// GET /apps
export async function getAppsPageHandler(req: Request, res: Response) {
	const apps = await db
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

	return res.render('apps.html', {
		apps,
		path: '/apps',
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
	return res.redirect('/apps');
}

// POST /apps/:id
export async function postAppUpdateHandler(req: Request, res: Response) {
	const { name, url, description } = req.body;

	const id = parseInt(req.params.id!);

	const is_active = req.body.is_active === 'on' ? true : false;

	await db('apps').where({ id }).update({
		is_active,
		name,
		url,
		description,
		updated_at: db.fn.now(),
	});

	return res.redirect(`/apps/${id}`);
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

	return res.redirect(`/apps/${aid}/channels`);
}

// POST '/apps/:id/notifications/:nid/delete'
export async function postDeleteAppNotificationHandler(req: Request, res: Response) {
	const { id, nid } = req.params;

	await db('notifications').where({ id: nid }).del();

	return res.redirect(`/apps/${id}/notifications`);
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

	const config = await db
		.select('*')
		.from(`${channel.channel_type_name}_configs`)
		.where({ id: cfid })
		.first();

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

	res.redirect(`/apps/${id}/channels`);
}

// POST '/apps/:aid/channels/:cid/configs/:cfid/discord'
export async function postUpdateAppChannelDiscordHandler(req: Request, res: Response) {
	const { id, cfid } = req.params;
	const { name, is_active, webhook_url } = req.body;

	await db('discord_configs')
		.where({ id: cfid })
		.update({
			webhook_url: webhook_url,
			name,
			is_active: is_active === 'on',
			updated_at: db.fn.now(),
		});

	res.redirect(`/apps/${id}/channels`);
}

// POST '/apps/:aid/channels/:cid/configs/:cfid/email'
export async function postUpdateAppChannelEmailHandler(req: Request, res: Response) {
	const { id, cfid } = req.params;

	const { name, is_active, host, port, alias, auth_email, auth_pass } = req.body;

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

	res.redirect(`/apps/${id}/channels`);
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

	await db('discord_configs').insert({
		app_channel_id: app_channel.id,
		webhook_url: webhook_url,
		name,
		is_active: is_active === 'on',
	});

	return res.redirect(`/apps/${id}/channels`);
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

	return res.redirect(`/apps/${id}/channels`);
}

// POST /apps/:id/channels/email
export async function postCreateAppEmailChannelConfigHandler(req: Request, res: Response) {
	const { id } = req.params;
	const { name, is_active, host, port, alias, auth_email, auth_pass } = req.body;

	const channel_type = await db.select('id').from('channel_types').where({ name: 'email' }).first();

	const [app_channel] = await db('app_channels')
		.insert({
			app_id: id,
			channel_type_id: channel_type.id,
		})
		.returning('*');

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

	return res.redirect(`/apps/${id}/channels`);
}

// GET /apps/:id/notifications
export async function getAppNotificationsPageHandler(req: Request, res: Response) {
	const app = await db
		.select(
			'apps.*',
			db.raw(
				"COALESCE(json_agg(notifications.* ORDER BY notifications.created_at DESC) FILTER (WHERE notifications.id IS NOT NULL), '[]') as notifications",
			),
		)
		.from('apps')
		.leftJoin('notifications', 'apps.id', 'notifications.app_id')
		.where('apps.id', req.params.id)
		.groupBy('apps.id')
		.first();

	return res.render('apps-id-notifications.html', {
		app,
		layout: '../layouts/app.html',
		path: `/apps/${req.params.id}/notifications`,
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

	const [app] = await db('apps')
		.insert({
			name,
			url,
			description,
			is_active: is_active === 'on',
		})
		.returning('*');

	return res.redirect(`/apps/${app.id}`);
}

// GET /logout
export function getLogoutHandler(req: Request, res: Response) {
	return res.redirect('/');
}

// GET /oauth/github
export async function getGithub(req: Request, res: Response) {
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
		throw new UnauthorizedError('Something went wrong while authenticating with github');
	}

	const { access_token } = await getGithubOauthToken(code);

	const emails = await getGithubUserEmails(access_token);

	const email = emails.filter((email) => email.primary && email.verified)[0]?.email;

	const foundUser = await db.select('*').from('users').where({ email }).first();

	if (!foundUser) {
		// create a user
	}

	// add it to session

	res.redirect('/apps');
}
