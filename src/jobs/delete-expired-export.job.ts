import { db } from '../db/db';
import { logger } from '../logger';
import { setupJob } from '../utils';
import { backBlaze, s3Client } from '../config';
import { DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DeleteExpiredExportJobData {}

export const deleteExpiredExportJob = setupJob<DeleteExpiredExportJobData>(
	'deleteExpiredExportJob',
	async (_job) => {
		logger.info('[deleteExpiredExportJob] Starting job');

		try {
			const now = new Date();
			const expirationTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

			const listCommand = new ListObjectsV2Command({
				Bucket: backBlaze.bucket,
				Prefix: 'exports/',
			});

			const listResponse = await s3Client.send(listCommand);

			if (listResponse.Contents) {
				logger.info(`[deleteExpiredExportJob] Processing ${listResponse.Contents.length} objects`);

				for (const object of listResponse.Contents) {
					if (object.Key && object.LastModified) {
						const fileAge = now.getTime() - object.LastModified.getTime();

						if (fileAge > expirationTime) {
							logger.info(`[deleteExpiredExportJob] Deleting expired file: ${object.Key}`);

							const deleteCommand = new DeleteObjectCommand({
								Bucket: backBlaze.bucket,
								Key: object.Key,
							});

							await s3Client.send(deleteCommand);
							logger.info(
								`[deleteExpiredExportJob] Successfully deleted expired file: ${object.Key}`,
							);

							// Extract user ID from the file name
							const match = object.Key.match(/user_data_(\d+)_/);
							if (match && match[1]) {
								const userId = match[1];

								await db('users')
									.where('id', userId)
									.decrement('export_count', 1)
									.where('export_count', '>', 0);

								logger.info(`[deleteExpiredExportJob] Decremented export_count for user ${userId}`);
							}
						}
					}
				}
			} else {
				logger.info('[deleteExpiredExportJob] No objects found to process');
			}

			logger.info('[deleteExpiredExportJob] Completed deleteExpiredExportJob');
		} catch (error) {
			logger.error(
				{ err: error },
				'[deleteExpiredExportJob] Failed to process deleteExpiredExportJob',
			);
		}
	},
);
