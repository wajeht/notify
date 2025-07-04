import { db } from '../db/db';
import { logger } from '../logger';
import { setupJob, dayjs } from '../utils';
import { sendGeneralEmailJob } from './general-email.job';

export const resetUserMonthlyAlertLimitJob = setupJob<any>(
	'resetUserMonthlyAlertLimitJob',
	async (_job) => {
		logger.info('[resetUserMonthlyAlertLimitJob] Starting job');
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
				logger.info('[resetUserMonthlyAlertLimitJob] No apps to reset today');
				return;
			}

			logger.info(`[resetUserMonthlyAlertLimitJob] Resetting ${appsToReset.length} apps`);

			const resetPromises = appsToReset.map(async (app) => {
				const now = dayjs().tz(app.timezone);
				const nextResetDate = now.add(1, 'month').startOf('month').toDate();

				try {
					await db.transaction(async (trx) => {
						await trx('apps').where('id', app.id).update({
							alerts_sent_this_month: 0,
							alerts_reset_date: nextResetDate,
						});

						await sendGeneralEmailJob({
							email: app.email,
							subject: 'Monthly Alert Limit Reset',
							username: app.username,
							message: `Your monthly alert limit for the app "${app.name}" has been reset on ${now.format('MMMM D, YYYY')}.
                            Your alert count has been set back to 0, and you can now send new alerts for this month.
                            The next reset will occur on ${dayjs(nextResetDate).format('MMMM D, YYYY')}.`,
						});
					});

					logger.info(`[resetUserMonthlyAlertLimitJob] Reset alert count for app ${app.id}`);
				} catch (error) {
					logger.error(`[resetUserMonthlyAlertLimitJob] Failed to reset app ${app.id}:`, error);
				}
			});

			await Promise.all(resetPromises);
			logger.info('[resetUserMonthlyAlertLimitJob] Job completed successfully');
		} catch (error) {
			logger.error('[resetUserMonthlyAlertLimitJob] Job failed:', error);
		}
	},
);
