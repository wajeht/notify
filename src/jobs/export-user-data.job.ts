import { setupJob } from '../utils';
import { logger } from '../logger';

export interface ExportUserDataJobData {
	userId: string;
}

export const exportUserDataJob = setupJob<ExportUserDataJobData>(
	'exportUserDataJob',
	async (job) => {
		try {
			// Todo
		} catch (error) {
			logger.error('failed to process exportUserDataJob job:', error);
			// throw error;
		}
	},
);
