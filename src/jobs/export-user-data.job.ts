import { setupJob } from '../utils';
import { logger } from '../logger';
import { db } from '../db/db';

export interface ExportUserDataJobData {
	userId: string;
}

export const exportUserDataJob = setupJob<ExportUserDataJobData>(
	'exportUserDataJob',
	async (job) => {
		try {
			const user = await db.select('*').from('users').where('id', job.data.userId).first();

			if (!user) {
				logger.info('user does not exist. quitting exportUserDataJob.');
				return;
			}

			const apps = await db.select('*').from('apps').where('apps.user_id', user.id);

			if (!apps.length) {
				logger.info('user apps does not exist. quitting exportUserDataJob.');
				return;
			}
		} catch (error) {
			logger.error('failed to process exportUserDataJob job:', error);
			// throw error;
		}
	},
);
