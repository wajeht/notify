import { sendEmail } from './channel/email';
import { setupJob } from '../utils';
import { logger } from '../logger';
import { EmailConfig } from '../types';

export interface EmailNotificationJobData {
	config: EmailConfig;
	username: string;
	message: string;
	details: Record<string, any> | null;
}

export const sendEmailNotificationJob = setupJob<EmailNotificationJobData>(
	'sendEmailNotificationJob',
	async (job) => {
		logger.info('[sendEmailNotificationJob] Starting job');
		try {
			await sendEmail(job.data);
			logger.info('[sendEmailNotificationJob] Email sent successfully');
		} catch (error) {
			logger.error('[sendEmailNotificationJob] Failed to send email:', error);
			// throw error;
		}
	},
);
