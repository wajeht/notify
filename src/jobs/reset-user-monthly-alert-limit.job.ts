import { db } from '../db/db';
import { setupJob, dayjs } from '../utils';

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
						await trx('apps')
							.where('id', app.id)
							.update({
								alerts_sent_this_month: 0,
								alerts_reset_date: now.add(1, 'month').startOf('month').toDate(),
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
