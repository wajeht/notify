import { SmsConfig } from '../types';

export interface SmsNotificationJobData {
	config: SmsConfig;
	message: string;
	details: Record<string, any> | null;
}

export { sendSms } from './channel/sms';
