import { setupJob } from '../utils';
import { logger } from '../logger';
import { backBlaze, s3Client } from '../config';
import { DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

export interface DeleteExpiredExportJobData {}

export const deleteExpiredExportJob = setupJob<DeleteExpiredExportJobData>(
	'deleteExpiredExportJob',
	async (job) => {
		logger.info('Starting deleteExpiredExportJob');
		try {
			const now = new Date();
			const expirationTime = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

			const listCommand = new ListObjectsV2Command({
				Bucket: backBlaze.bucket,
				Prefix: 'exports/',
			});

			const listResponse = await s3Client.send(listCommand);

			if (listResponse.Contents) {
				for (const object of listResponse.Contents) {
					if (object.Key && object.LastModified) {
						const fileAge = now.getTime() - object.LastModified.getTime();

						if (fileAge > expirationTime) {
							logger.info(`Deleting expired file: ${object.Key}`);

							const deleteCommand = new DeleteObjectCommand({
								Bucket: backBlaze.bucket,
								Key: object.Key,
							});

							await s3Client.send(deleteCommand);
							logger.info(`Successfully deleted expired file: ${object.Key}`);
						}
					}
				}
			}

			logger.info('Completed deleteExpiredExportJob');
		} catch (error) {
			logger.error('Failed to process deleteExpiredExportJob:', error);
			// throw error;
		}
	},
);
