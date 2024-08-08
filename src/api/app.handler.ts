import { Request, Response } from 'express';

export function getHealthzHandler() {
	return async (req: Request, res: Response) => {
		res.json({ message: 'ok' });
	};
}
