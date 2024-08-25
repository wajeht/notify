import { sendSms } from './channel/sms';
import { setupJob } from '../utils';
import { SmsConfig } from '../types';

export interface SmsNotificationJobData {
	config: SmsConfig;
	message: string;
	details: Record<string, any> | null;
}

export const sendSmsNotificationJob = setupJob<SmsNotificationJobData>(
	'sendSmsNotificationJob',
	async (job) => {
		try {
			// await sendSms(job.data);
		} catch (error) {
			console.error('failed to process sms notification job:', error);
			// throw error;
		}
	},
);
