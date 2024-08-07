import { Request, Response } from 'express';

export function getHealthzHandler() {
	return async (req: Request, res: Response) => {
		res.json({ message: 'ok' });
	};
}

export function postNotificationHandler() {
	return async (req: Request, res: Response) => {
		console.log(req.body);
		res.json({ message: 'ok' });
	};
}
