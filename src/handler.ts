import { Request, Response } from 'express';

export function getHealthzHandler(req: Request, res: Response) {
	return res.json({ message: 'ok' });
}

export function postNotificationHandler(req: Request, res: Response) {
	console.log(req.body);

	return res.json({
		success: true,
		message: 'Notification created and queued successfully',
		notificationId: 'generated_uuid',
		jobId: 'generated_job_id',
		channels: ['email', 'sms'],
	});
}
