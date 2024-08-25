import { db } from '../../db/db';
import { sendEmailNotificationJob } from '../email.job';
import { NotificationJobData } from '../notification.job';
import { sendDiscordNotificationJob } from '../discord.job';
import { sendSmsNotificationJob } from '../sms.job';

export async function sendNotification(data: NotificationJobData) {
	try {
		const { appId, message, details } = data;

		const app = await db('apps').where({ id: appId, is_active: true }).first();

		if (!app) {
			console.log('Cannot find active app. Quitting notification job');
			return;
		}

		const appChannels = await db('app_channels')
			.join('channel_types', 'app_channels.channel_type_id', 'channel_types.id')
			.where('app_channels.app_id', appId)
			.select('channel_types.name as channel_type', 'app_channels.id as app_channel_id');

		for (const channel of appChannels) {
			let configs;

			switch (channel.channel_type) {
				case 'discord':
					configs = await db('discord_configs').where({
						app_channel_id: channel.app_channel_id,
						is_active: true,
					});
					break;
				case 'sms':
					configs = await db('sms_configs').where({
						app_channel_id: channel.app_channel_id,
						is_active: true,
					});
					break;
				case 'email':
					configs = await db('email_configs').where({
						app_channel_id: channel.app_channel_id,
						is_active: true,
					});
					break;
				default:
					console.log(`Unknown channel type: ${channel.channel_type}`);
					continue;
			}

			for (const config of configs) {
				await dispatchNotificationJob(channel.channel_type, config, message, details);
			}
		}

		await db('notifications').insert({
			app_id: appId,
			message: message,
			details: details,
		});

		console.log(`notification jobs dispatched for app ${appId}`);
	} catch (error) {
		console.error('error in sendNotification:', error);
		// throw error
	}
}

async function dispatchNotificationJob(
	channelType: 'discord' | 'email' | 'sms',
	config: any,
	message: string,
	details: any,
) {
	try {
		switch (channelType) {
			case 'discord':
				await sendDiscordNotificationJob({ config, message, details });
				break;
			case 'email':
				await sendEmailNotificationJob({ config, message, details });
				break;
			case 'sms':
				await sendSmsNotificationJob({ config, message, details });
				break;
			default:
				throw new Error(`Unsupported channel type: ${channelType}`);
		}
	} catch (error) {
		console.error('Failed to dispatch notification job:', {
			channelType,
			config,
			message,
			details,
			error,
		});
		// throw error;
	}
}
