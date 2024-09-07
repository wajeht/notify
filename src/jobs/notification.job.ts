import { sendNotification } from './channel/notification';
import { setupJob, logger } from '../utils';

export interface NotificationJobData {
	userId: number;
	appId: string;
	message: string;
	details: Record<string, unknown>;
}

export const sendNotificationJob = setupJob<NotificationJobData>(
	'sendNotificationJob',
	async (job) => {
		try {
			await sendNotification(job.data);
		} catch (error) {
			logger.error('failed to process notification job:', error);
			// throw error;
		}
	},
);
