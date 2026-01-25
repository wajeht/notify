import { logger } from '../logger';
import { setupJob } from '../utils';
import { DiscordConfig } from 'types';
import { sendDiscord } from './channel/discord';

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
			logger.error(
				{ err: error },
				'[sendDiscordNotificationJob] Failed to send Discord notification',
			);
		}
	},
);
