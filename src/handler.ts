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

// GET /profile
export function getProfilePageHandler(req: Request, res: Response) {
	return res.render('profile.html', {
		path: '/profile',
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

// GET /apps/:id/channels
export async function getAppChannelsPageHandler(req: Request, res: Response) {
	const [app] = await db
		.select('*')
		.from('apps')
		.where({ id: parseInt(req.params.id!) });
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
