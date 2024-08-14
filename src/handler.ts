import { Request, Response } from 'express';
import { db } from './db/db';

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
		layout: '../layouts/auth.html',
	});
}

// GET /notifications
export function getNotificationsPageHandler(req: Request, res: Response) {
	return res.render('notifications.html', {
		path: '/notifications',
		layout: '../layouts/auth.html',
	});
}

// GET /jobs
export function getJobsPageHandler(req: Request, res: Response) {
	return res.render('jobs.html', {
		path: '/jobs',
		layout: '../layouts/auth.html',
	});
}

// GET /apps
export async function getAppsPageHandler(req: Request, res: Response) {
	const apps = await db.select('*').from('apps');
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
						'name', app_channels.name,
						'app_id', app_channels.app_id,
						'is_active', app_channels.is_active,
						'channel_type', channel_types.name,
						'config', CASE
							WHEN channel_types.name = 'email' THEN
								json_build_object('host', email_configs.host, 'port', email_configs.port, 'alias', email_configs.alias, 'auth_email', email_configs.auth_email)
							WHEN channel_types.name = 'sms' THEN
								json_build_object('account_sid', sms_configs.account_sid, 'from_phone_number', sms_configs.from_phone_number, 'phone_number', sms_configs.phone_number)
							WHEN channel_types.name = 'discord' THEN
								json_build_object('webhook_url', discord_configs.webhook_url)
							ELSE NULL
						END
					)
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

// GET /apps/:id/notifications
export async function getAppNotificationsPageHandler(req: Request, res: Response) {
	const app = await db
		.select(
			'apps.*',
			db.raw(
				"COALESCE(json_agg(notifications.*) FILTER (WHERE notifications.id IS NOT NULL), '[]') as notifications",
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
	const { name, is_active } = req.body;

	const [app] = await db('apps')
		.insert({
			name,
			is_active: is_active === 'on',
		})
		.returning('*');

	return res.redirect(`/apps/${app.id}`);
}

// GET /logout
export function getLogoutHandler(req: Request, res: Response) {
	return res.redirect('/');
}
