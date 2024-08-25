import twilio from 'twilio';
import { smsConfig } from '../../config';
import { SmsNotificationJobData } from '../sms.job';

const client = twilio(smsConfig.accountSid, smsConfig.authToken);

export async function sendSms(data: SmsNotificationJobData): Promise<void> {
	try {
		const message = await client.messages.create({
			body: `${data.message}\n\n${JSON.stringify(data.details)}`,
			from: data.config.from_phone_number,
			to: data.config.phone_number,
		});

		console.log(`SMS sent: ${message.sid}`);
	} catch (error) {
		console.error('Failed to send SMS:', error);
		// throw error;
	}
}
