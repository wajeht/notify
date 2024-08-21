import { sendEmail } from './channel/email';
import { setupJob } from '../utils';
import { EmailConfig } from '../types';

export interface EmailNotificationJobData {
	config: EmailConfig;
	message: string;
	details: Record<string, any> | null;
}

export const sendEmailNotificationJob = setupJob<EmailNotificationJobData>(
	'sendEmailNotificationJob',
	async (job) => {
		try {
			await sendEmail(job.data);
		} catch (error) {
			console.error('failed to process email notification job:', error);
			// throw error;
		}
	},
);
