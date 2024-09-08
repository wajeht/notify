import { setupJob, secret } from '../utils';
import { logger } from '../logger';
import { db } from '../db/db';
import { backBlaze, s3Client } from '../config';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { sendGeneralEmailJob } from './general-email.job';

async function generateSignedUrl(key: string, filename: string): Promise<string> {
	logger.info(`Generating signed URL for key: ${key}, filename: ${filename}`);
	const command = new GetObjectCommand({
		Bucket: backBlaze.bucket,
		Key: key,
		ResponseContentDisposition: `attachment; filename="${filename}"`,
		ResponseContentType: 'application/json',
	});
	return getSignedUrl(s3Client, command, { expiresIn: 3600 * 24 }); // URL expires in 24 hours
}

export interface ExportUserDataJobData {
	userId: string;
}

export const exportUserDataJob = setupJob<ExportUserDataJobData>(
	'exportUserDataJob',
	async (job) => {
		logger.info(`Starting exportUserDataJob for userId: ${job.data.userId}`);
		try {
			const user = await db.select('*').from('users').where('id', job.data.userId).first();
			if (!user) {
				logger.info('User does not exist. Quitting exportUserDataJob.');
				return;
			}
			logger.info(`User found: ${user.id}`);

			if (user.export_count >= user.max_export_count_allowed) {
				logger.info(`User ${user.id} has reached their export limit. Quitting exportUserDataJob.`);

				await sendGeneralEmailJob({
					email: user.email,
					subject: 'Export Limit Reached',
					username: user.username,
					message: `You have reached your limit of ${user.max_export_count_allowed} exports. Please contact support if you need additional exports.`,
				});

				return;
			}

			const apps = await db.select('*').from('apps').where('apps.user_id', user.id);
			if (!apps.length) {
				logger.info('User apps do not exist. Quitting exportUserDataJob.');
				return;
			}
			logger.info(`Found ${apps.length} apps for user`);

			const result = [];
			for (const app of apps) {
				logger.info(`Processing app: ${app.id}`);
				const channels = await db
					.select('channel_types.name as channel_type_name', 'app_channels.id as app_channel_id')
					.from('app_channels')
					.leftJoin('channel_types', 'channel_types.id', 'app_channels.channel_type_id')
					.leftJoin('apps', 'apps.id', 'app_channels.app_id')
					.where({ app_id: app.id, 'apps.user_id': app.user_id });
				logger.info(`Found ${channels.length} channels for app ${app.id}`);

				const configs = await Promise.all(
					channels.map(async (channel) => {
						const { channel_type_name, app_channel_id } = channel;
						logger.info(`Processing channel: ${channel_type_name}, id: ${app_channel_id}`);
						if (['discord', 'sms', 'email'].includes(channel_type_name)) {
							const config = await db
								.select('*')
								.from(`${channel_type_name}_configs`)
								.where({ app_channel_id })
								.first();
							if (config) {
								logger.info(`Config found for ${channel_type_name}`);
								const { created_at, updated_at, app_channel_id, id, name, ...cleanedConfig } =
									config;
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
				logger.info(`Processed ${configs.length} configs for app ${app.id}`);

				result.push({
					name: app.name,
					url: app.url,
					description: app.description,
					is_active: app.is_active,
					configs,
				});
			}

			const filename = `user_data_${user.id}_${crypto.randomUUID()}.json`;
			const key = `exports/${filename}`;
			logger.info(`Preparing to upload file: ${filename}`);

			const uploadCommand = new PutObjectCommand({
				Bucket: backBlaze.bucket,
				Key: key,
				Body: JSON.stringify(result, null, 2),
				ContentType: 'application/json',
			});
			await s3Client.send(uploadCommand);
			logger.info(`File uploaded successfully: ${key}`);

			await db('users').where('id', user.id).increment('export_count', 1);

			const downloadUrl = await generateSignedUrl(key, filename);
			logger.info(`Generated download URL for file: ${filename}`);

			const message = `
            <p>Your requested data export is now ready. You can download it using the following link:</p>
            <p><a href="${downloadUrl}">Download</a></p>
            <p>This link will expire in 24 hours.</p>
            <p>You have used ${user.export_count + 1} out of ${user.max_export_count_allowed} allowed exports.</p>`;

			await sendGeneralEmailJob({
				email: user.email,
				subject: '🎉 Your Data Export is Ready',
				username: user.username,
				message: message.trim(),
			});
			logger.info(`Sent email notification to user: ${user.email}`);
		} catch (error) {
			logger.error('Failed to process exportUserDataJob job:', error);
			// throw error;
		}
	},
);
