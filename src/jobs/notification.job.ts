import { logger } from '../logger';
import { setupJob } from '../utils';
import { sendNotification } from './channel/notification';

export interface NotificationJobData {
	userId: number;
	appId: string;
	message: string;
	details: Record<string, unknown>;
}

export const sendNotificationJob = setupJob<NotificationJobData>(
	'sendNotificationJob',
	async (job) => {
		logger.info('[sendNotificationJob] Starting job');
		try {
			await sendNotification(job.data);
			logger.info('[sendNotificationJob] Notification sent successfully');
		} catch (error) {
			logger.error('[sendNotificationJob] Failed to send notification:', error);
		}
	},
);
