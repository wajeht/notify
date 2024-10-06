import { sendSms } from './channel/sms';
import { setupJob } from '../utils';
import { logger } from '../logger';
import { SmsConfig } from '../types';

export interface SmsNotificationJobData {
	config: SmsConfig;
	message: string;
	details: Record<string, any> | null;
}

export const sendSmsNotificationJob = setupJob<SmsNotificationJobData>(
	'sendSmsNotificationJob',
	async (job) => {
		logger.info('[sendSmsNotificationJob] Starting job');
		try {
			await sendSms(job.data);
			logger.info('[sendSmsNotificationJob] SMS sent successfully');
		} catch (error) {
			logger.error('[sendSmsNotificationJob] Failed to send SMS:', error);
		}
	},
);
