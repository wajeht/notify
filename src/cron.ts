import * as cron from 'node-cron';
import type { Knex } from 'knex';
import type { Logger } from 'pino';
import { DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { backBlaze, s3Client } from './config';
import { dayjs, sendGeneralEmail } from './utils';

export interface CronType {
	start: () => void;
	stop: () => void;
	getStatus: () => { isRunning: boolean; jobCount: number };
	tasks: {
		resetUserMonthlyAlertLimit: () => Promise<void>;
		deleteExpiredExport: () => Promise<void>;
	};
}

export function createCron(db: Knex, logger: Logger): CronType {
	const cronJobs: cron.ScheduledTask[] = [];
	let isRunning = false;

	async function resetUserMonthlyAlertLimit(): Promise<void> {
		logger.info('[cron:resetUserMonthlyAlertLimit] Starting');

		try {
			const appsToReset = await db
				.select(
					'apps.id',
					'apps.name',
					'apps.alerts_reset_date',
					'users.timezone',
					'users.email',
					'users.username',
				)
				.from('apps')
				.innerJoin('users', 'users.id', 'apps.user_id')
				.where('apps.alerts_reset_date', '<=', dayjs().toDate());

			if (appsToReset.length === 0) {
				logger.info('[cron:resetUserMonthlyAlertLimit] No apps to reset today');
				return;
			}

			logger.info(
				{ count: appsToReset.length },
				'[cron:resetUserMonthlyAlertLimit] Resetting apps',
			);

			for (const app of appsToReset) {
				const now = dayjs().tz(app.timezone);
				const nextResetDate = now.add(1, 'month').startOf('month').toDate();

				try {
					await db.transaction(async (trx) => {
						await trx('apps').where('id', app.id).update({
							alerts_sent_this_month: 0,
							alerts_reset_date: nextResetDate,
						});
					});

					// Send email outside transaction (fire-and-forget)
					sendGeneralEmail({
						email: app.email,
						subject: 'Monthly Alert Limit Reset',
						username: app.username,
						message: `Your monthly alert limit for the app "${app.name}" has been reset on ${now.format('MMMM D, YYYY')}.
                            Your alert count has been set back to 0, and you can now send new alerts for this month.
                            The next reset will occur on ${dayjs(nextResetDate).format('MMMM D, YYYY')}.`,
					}).catch((err) =>
						logger.error({ err }, '[cron:resetUserMonthlyAlertLimit] Failed to send email'),
					);

					logger.info(
						{ appId: app.id },
						'[cron:resetUserMonthlyAlertLimit] Reset alert count for app',
					);
				} catch (error) {
					logger.error(
						{ err: error, appId: app.id },
						'[cron:resetUserMonthlyAlertLimit] Failed to reset app',
					);
				}
			}

			logger.info('[cron:resetUserMonthlyAlertLimit] Completed');
		} catch (error) {
			logger.error({ err: error }, '[cron:resetUserMonthlyAlertLimit] Job failed');
		}
	}

	async function deleteExpiredExport(): Promise<void> {
		logger.info('[cron:deleteExpiredExport] Starting');

		try {
			const now = new Date();
			const expirationTime = 24 * 60 * 60 * 1000; // 24 hours

			const listCommand = new ListObjectsV2Command({
				Bucket: backBlaze.bucket,
				Prefix: 'exports/',
			});

			const listResponse = await s3Client.send(listCommand);

			if (listResponse.Contents) {
				logger.info(
					{ count: listResponse.Contents.length },
					'[cron:deleteExpiredExport] Processing objects',
				);

				for (const object of listResponse.Contents) {
					if (object.Key && object.LastModified) {
						const fileAge = now.getTime() - object.LastModified.getTime();

						if (fileAge > expirationTime) {
							logger.info({ key: object.Key }, '[cron:deleteExpiredExport] Deleting expired file');

							const deleteCommand = new DeleteObjectCommand({
								Bucket: backBlaze.bucket,
								Key: object.Key,
							});

							await s3Client.send(deleteCommand);

							// Extract user ID from filename and decrement export_count
							const match = object.Key.match(/user_data_(\d+)_/);
							if (match && match[1]) {
								const userId = match[1];
								await db('users')
									.where('id', userId)
									.where('export_count', '>', 0)
									.decrement('export_count', 1);
								logger.info({ userId }, '[cron:deleteExpiredExport] Decremented export_count');
							}
						}
					}
				}
			} else {
				logger.info('[cron:deleteExpiredExport] No objects found');
			}

			logger.info('[cron:deleteExpiredExport] Completed');
		} catch (error) {
			logger.error({ err: error }, '[cron:deleteExpiredExport] Job failed');
		}
	}

	function start(): void {
		if (isRunning) {
			logger.warn('[cron] Already running');
			return;
		}

		// Daily at midnight: reset user monthly alert limits
		cronJobs.push(
			cron.schedule('0 0 * * *', async () => {
				logger.info('[cron] Running resetUserMonthlyAlertLimit');
				await resetUserMonthlyAlertLimit();
			}),
		);

		// Daily at midnight: delete expired exports
		cronJobs.push(
			cron.schedule('0 0 * * *', async () => {
				logger.info('[cron] Running deleteExpiredExport');
				await deleteExpiredExport();
			}),
		);

		isRunning = true;
		logger.info({ jobCount: cronJobs.length }, '[cron] Started');
	}

	function stop(): void {
		for (const job of cronJobs) {
			job.stop();
		}
		cronJobs.length = 0;
		isRunning = false;
		logger.info('[cron] Stopped');
	}

	function getStatus(): { isRunning: boolean; jobCount: number } {
		return { isRunning, jobCount: cronJobs.length };
	}

	return {
		start,
		stop,
		getStatus,
		tasks: {
			resetUserMonthlyAlertLimit,
			deleteExpiredExport,
		},
	};
}
