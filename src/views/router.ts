import express from 'express';
import { Request, Response } from 'express';
import { catchAsyncErrorMiddleware } from '../middleware';

const router = express.Router();

router.get(
	'/',
	catchAsyncErrorMiddleware((req: Request, res: Response) => {
		return res.render('home.html');
	}),
);

router.post(
	'/',
	catchAsyncErrorMiddleware((req: Request, res: Response) => {
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
	}),
);

router.get(
	'/healthz',
	catchAsyncErrorMiddleware((req: Request, res: Response) => {
		return res.setHeader('Content-Type', 'text/html').status(200).send('<p>ok</p>');
	}),
);

router.get(
	'/dashboard',
	catchAsyncErrorMiddleware((req: Request, res: Response) => {
		return res.render('dashboard.html');
	}),
);

export { router };
