import { Request, Response } from 'express';

// GET /healthz
export function getHealthzHandler(req: Request, res: Response) {
	return res.setHeader('Content-Type', 'text/html').status(200).send('<p>ok</p>');
}

// GET /terms-of-service
export function getTermsOfServicePageHandler(req: Request, res: Response) {
	return res.render('terms-of-service.html');
}

// GET /
export function getHomePageHandler(req: Request, res: Response) {
	return res.render('home.html');
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

// GET /dashboard
export function getDashboardPageHandler(req: Request, res: Response) {
	return res.render('dashboard.html', {
		layout: '../layouts/dashboard.html',
	});
}
