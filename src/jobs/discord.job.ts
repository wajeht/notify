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
		logger.info('[sendDiscordNotificationJob] Starting job');
		try {
			await sendDiscord(job.data);
			logger.info('[sendDiscordNotificationJob] Discord notification sent successfully');
		} catch (error) {
			logger.error('[sendDiscordNotificationJob] Failed to send Discord notification:', error);
		}
	},
);
