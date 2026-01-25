import { DiscordConfig } from '../types';

export interface DiscordNotificationJobData {
	config: DiscordConfig;
	message: string;
	details: Record<string, unknown> | null;
}

export { sendDiscord } from './channel/discord';
