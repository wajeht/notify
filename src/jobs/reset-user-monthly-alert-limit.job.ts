import { db } from '../db/db';
import { setupJob, dayjs } from '../utils';
import { sendGeneralEmailJob } from './general-email.job';

export const resetUserMonthlyAlertLimitJob = setupJob<any>(
	'resetUserMonthlyAlertLimitJob',
	async (job) => {
		try {
			console.log('[resetUserMonthlyAlertLimitJob] Started');

			const apps = await db.select('*').from('apps').leftJoin('users', 'users.id', 'apps.user_id');

			for (const app of apps) {
				const now = dayjs().tz(app.timezone);
				const resetDate = dayjs(app.alerts_reset_date).tz(app.timezone);

				if (now.isAfter(resetDate)) {
					await db.transaction(async (trx) => {
						const nextResetDate = now.add(1, 'month').startOf('month').toDate();
						await trx('apps').where('id', app.id).update({
							alerts_sent_this_month: 0,
							alerts_reset_date: nextResetDate,
						});

						const user = await db.select('*').from('users').where({ id: app.user_id }).first();

						await sendGeneralEmailJob({
							email: user.email,
							subject: 'Monthly Alert Limit Reset',
							username: user.username,
							message: `Your monthly alert limit for the app "${app.name}" has been reset on ${now.format('MMMM D, YYYY')}.
													Your alert count has been set back to 0, and you can now send new alerts for this month.
													The next reset will occur on ${nextResetDate}.`,
						});

						console.log(
							`[resetUserMonthlyAlertLimitJob] Reset alert count for app ${app.id} (${app.name})`,
						);
					});
				}

				console.log(
					`[resetUserMonthlyAlertLimitJob] Skipped reset for app ${app.id} (${app.name})`,
				);
			}

			console.log('[resetUserMonthlyAlertLimitJob] Finished');
		} catch (error) {
			console.error('[resetUserMonthlyAlertLimitJob] Failed to process:', error);
			// throw error;
		}
	},
);
