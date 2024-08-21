import { sendNotification } from './channel/notification';
import { setupJob } from '../utils';

export interface NotificationJobData {
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
			console.error('failed to process notification job:', error);
			// throw error;
		}
	},
);
