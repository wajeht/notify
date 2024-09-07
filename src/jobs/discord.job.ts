import { logger } from '../logger';
import { sendDiscord } from './channel/discord';
import { setupJob } from '../utils';
import { DiscordConfig } from 'types';

export interface DiscordNotificationJobData {
	config: DiscordConfig;
	message: string;
	details: Record<string, unknown> | null;
}

export const sendDiscordNotificationJob = setupJob<DiscordNotificationJobData>(
	'sendDiscordNotificationJob',
	async (job) => {
		try {
			await sendDiscord(job.data);
		} catch (error) {
			logger.error('failed to process discord notification job:', error);
			// throw error;
		}
	},
);
