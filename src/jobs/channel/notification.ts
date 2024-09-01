import { db } from '../../db/db';
import { sendEmailNotificationJob } from '../email.job';
import { NotificationJobData } from '../notification.job';
import { sendDiscordNotificationJob } from '../discord.job';
import { sendSmsNotificationJob } from '../sms.job';
import { sendGeneralEmailJob } from '../general-email.job';

export async function sendNotification(data: NotificationJobData) {
	try {
		const { appId, userId, message, details } = data;

		const app = await db('apps').where({ id: appId, is_active: true, user_id: userId }).first();

		if (!app) {
			console.log('Cannot find active app. Quitting notification job');
			return;
		}

		const user = await db.select('*').from('users').where({ id: userId }).first();

		if (user.is_admin === false) {
			if (app.max_monthly_alerts_allowed === app.alerts_sent_this_month) {
				console.log('You have reached your monthly quota. Please wait until next month!');

				await sendGeneralEmailJob({
					email: user.email,
					subject: `Monthly Quota Reached on ${app.name} 🔔 Notify`,
					username: user.username,
					message: `You have reached your monthly notification quota for the app "${app.name}". Notifications will continue to be available in the app, but we will stop sending them to your channels. Please wait until next month to resume channel notifications. Thank you for using Notify!`,
				});

				return;
			}

			if (app.user_monthly_limit_threshold === app.alerts_sent_this_month) {
				console.log(
					'You have reached your custom alert limit. Notifications will stop until you update your settings.',
				);

				await sendGeneralEmailJob({
					email: user.email,
					subject: `Custom Alert Limit Reached on ${app.name} 🔔 Notify`,
					username: user.username,
					message: `You have reached your custom notification limit for the app "${app.name}". Notifications will continue to be available in the app, but we will stop sending them to your channels until you update your limit in your settings. Thank you for using Notify!`,
				});

				return;
			}
		}

		const appChannels = await db('app_channels')
			.join('channel_types', 'app_channels.channel_type_id', 'channel_types.id')
			.where({ 'app_channels.app_id': appId, 'app_channels.is_active': true })
			.select('channel_types.name as channel_type', 'app_channels.id as app_channel_id');

		if (!appChannels.length) {
			console.log('no active channels for app', app.id);
			return;
		}

		for (const channel of appChannels) {
			let configs;

			switch (channel.channel_type) {
				case 'discord':
					configs = await db('discord_configs').where({ app_channel_id: channel.app_channel_id });
					break;
				case 'sms':
					configs = await db('sms_configs').where({ app_channel_id: channel.app_channel_id });
					break;
				case 'email':
					configs = await db('email_configs').where({ app_channel_id: channel.app_channel_id });
					break;
				default:
					console.log(`Unknown channel type: ${channel.channel_type}`);
					continue;
			}

			for (const config of configs) {
				await dispatchNotificationJob(
					channel.channel_type,
					config,
					user.username,
					message,
					details,
				);
			}
		}

		await db('notifications').insert({
			app_id: appId,
			message: message,
			details: details,
		});

		await db('apps')
			.update({ alerts_sent_this_month: app.alerts_sent_this_month + 1 })
			.where({ id: appId, user_id: userId });

		console.log(`notification jobs dispatched for app ${appId}`);
	} catch (error) {
		console.error('error in sendNotification:', error);
		// throw error
	}
}

async function dispatchNotificationJob(
	channelType: 'discord' | 'email' | 'sms',
	config: any,
	username: string,
	message: string,
	details: any,
) {
	try {
		switch (channelType) {
			case 'discord':
				return await sendDiscordNotificationJob({ config, message, details });
			case 'email':
				return await sendEmailNotificationJob({ config, username, message, details });
			case 'sms':
				return await sendSmsNotificationJob({ config, message, details });
			default:
				// Note: dont throw
				console.log(`Unsupported channel type: ${channelType}`);
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
