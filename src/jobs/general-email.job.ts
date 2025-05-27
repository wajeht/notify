import { logger } from '../logger';
import { setupJob, sendGeneralEmail } from '../utils';

export interface GeneralEmailJobData {
	email: string;
	subject: string;
	username: string;
	message: string;
}

export const sendGeneralEmailJob = setupJob<GeneralEmailJobData>(
	'sendGeneralEmailJob',
	async (job) => {
		logger.info('[sendGeneralEmailJob] Starting job');
		try {
			await sendGeneralEmail({
				email: job.data.email,
				subject: job.data.subject,
				username: job.data.username,
				message: job.data.message,
			});
			logger.info('[sendGeneralEmailJob] General email sent successfully');
		} catch (error) {
			logger.error('[sendGeneralEmailJob] Failed to send general email:', error);
		}
	},
);
