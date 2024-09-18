import { logger } from '../../logger';
import twilio from 'twilio';
import { SmsNotificationJobData } from '../sms.job';

export async function sendSms(data: SmsNotificationJobData): Promise<void> {
	const client = twilio(data.config.account_sid, data.config.auth_token);

	try {
		const message = await client.messages.create({
			body: `${data.message}\n\n${JSON.stringify(data.details)}`,
			from: data.config.from_phone_number,
			to: data.config.phone_number,
		});

		logger.info(`[sendSms] SMS sent: ${message.sid}`);
	} catch (error) {
		logger.error('[sendSms] Failed to send SMS:', error);
		// throw error;
	}
}
