import { DiscordNotificationJobData } from '../discord.job';
import { secret } from '../../utils';
import { logger } from '../../logger';

type Params = {
	username: string;
	content: any;
	embeds?: any;
};

export async function sendDiscord(data: DiscordNotificationJobData): Promise<void> {
	try {
		const params: Params = {
			username: 'notify.jaw.dev',
			content: data.message,
		};

		if (data.details) {
			params.embeds = [
				{
					title: data.message,
					description: JSON.stringify(data.details),
				},
			];
		}

		const res = await fetch(secret().decrypt(data.config.webhook_url), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params),
		});

		if (res.status === 204) {
			logger.info(`[sendDiscord] discord bot has sent: ${data.message}`);
		}
	} catch (error) {
		logger.error('[sendDiscord] error sending discord notification:', error);
	}
}
