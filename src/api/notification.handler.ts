import { Request, Response } from 'express';

export function postNotificationHandler() {
	return async (req: Request, res: Response) => {
		console.log(req.body);

		res.json({
			success: true,
			message: 'Notification created and queued successfully',
			notificationId: 'generated_uuid',
			jobId: 'generated_job_id',
			channels: ['email', 'sms'],
		});
	};
}
