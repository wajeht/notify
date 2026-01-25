import { logger } from '../logger';
import { setupJob } from '../utils';
import { SmsConfig } from '../types';
import { sendSms } from './channel/sms';

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
			logger.error({ err: error }, '[sendSmsNotificationJob] Failed to send SMS');
		}
	},
);
