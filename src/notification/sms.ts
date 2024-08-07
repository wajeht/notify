import twilio from 'twilio';
import { smsConfig } from '../config';

const client = twilio(smsConfig.accountSid, smsConfig.authToken);

export async function sendSms(
	body: string,
	from: string = smsConfig.fromPhoneNumber,
	to: string = smsConfig.toPhoneNumber,
): Promise<void> {
	try {
		const message = await client.messages.create({
			body,
			from,
			to,
		});
		console.log(`Message sent: ${message.body}`);
	} catch (error) {
		console.error('Failed to send SMS:', error);
	}
}
