import { Request, Response } from 'express';

export function getHealthzHandler() {
	return async (req: Request, res: Response) => {
		res.json({ message: 'ok' });
	};
}

export function postNotificationHandler() {
	return async (req: Request, res: Response) => {
		console.log(req.body);
		// {
		// 	"success": true,
		// 	"message": "Notification created and queued successfully",
		// 	"notificationId": "generated_uuid",
		// 	"jobId": "generated_job_id",
		// 	"channels": ["email", "sms"]
		// }
		res.json({ message: 'ok' });
	};
}
