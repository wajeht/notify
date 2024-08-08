import { Request, Response } from 'express';

// GET /healthz
export function getHealthzHandler(req: Request, res: Response) {
	const message = 'ok';

	if (req.get('Content-Type') === 'application/json') {
		return res.status(200).json({ message });
	}

	return res.setHeader('Content-Type', 'text/html').status(200).send('<p>ok</p>');
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
