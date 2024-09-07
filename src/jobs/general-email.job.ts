import { setupJob, sendGeneralEmail } from '../utils';
import { logger } from '../logger';

export interface GeneralEmailJobData {
	email: string;
	subject: string;
	username: string;
	message: string;
}

export const sendGeneralEmailJob = setupJob<GeneralEmailJobData>(
	'sendGeneralEmailJob',
	async (job) => {
		try {
			await sendGeneralEmail({
				email: job.data.email,
				subject: job.data.subject,
				username: job.data.username,
				message: job.data.message,
			});
		} catch (error) {
			logger.error('failed to process sendGeneralEmailJob job:', error);
			// throw error;
		}
	},
);
