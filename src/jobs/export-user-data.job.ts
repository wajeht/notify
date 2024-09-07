import { setupJob, secret } from '../utils';
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
				logger.info('user apps do not exist. quitting exportUserDataJob.');
				return;
			}

			const result = [];

			for (const app of apps) {
				const channels = await db
					.select('channel_types.name as channel_type_name', 'app_channels.id as app_channel_id')
					.from('app_channels')
					.leftJoin('channel_types', 'channel_types.id', 'app_channels.channel_type_id')
					.leftJoin('apps', 'apps.id', 'app_channels.app_id')
					.where({ app_id: app.id, 'apps.user_id': app.user_id });

				const configs = await Promise.all(
					channels.map(async (channel) => {
						const { channel_type_name, app_channel_id } = channel;
						if (['discord', 'sms', 'email'].includes(channel_type_name)) {
							const config = await db
								.select('*')
								.from(`${channel_type_name}_configs`)
								.where({ app_channel_id })
								.first();

							if (config) {
								// prettier-ignore
								const { created_at, updated_at, app_channel_id, id, name, ...cleanedConfig } = config;

								const decryptedConfig = Object.entries(cleanedConfig).reduce(
									(acc, [key, value]) => {
										if (typeof value === 'string') {
											acc[key] = secret().decrypt(value);
										} else {
											acc[key] = value;
										}
										return acc;
									},
									{} as any,
								);
								decryptedConfig.name = name;
								return { channel_type_name, config: decryptedConfig };
							}
						}
						return { channel_type_name, app_channel_id };
					}),
				);

				result.push({
					appName: app.name,
					configs,
				});
			}

			logger.info(result);
		} catch (error) {
			logger.error('failed to process exportUserDataJob job:', error);
			throw error;
		}
	},
);
