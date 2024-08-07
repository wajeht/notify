import path from 'path';
import dotenv from 'dotenv';
import { Env } from './types';

dotenv.config({ path: path.resolve(path.join(process.cwd(), '.env')) });

export const appConfig = {
	port: parseInt(process.env.APP_PORT || '80', 10),
	env: (process.env.APP_ENV as Env) || 'development',
	appUrl: process.env.APP_URL || '',
} as const;

export const emailConfig = {
	host: process.env.EMAIL_HOST || '',
	port: parseInt(process.env.EMAIL_PORT || '0', 10),
	alias: process.env.EMAIL_ALIAS || '',
	auth: {
		user: process.env.EMAIL_AUTH_EMAIL || '',
		pass: process.env.EMAIL_AUTH_PASS || '',
	},
} as const;

export const smsConfig = {
	accountSid: process.env.TWILIO_ACCOUNT_SID || '',
	authToken: process.env.TWILIO_AUTH_TOKEN || '',
	fromPhoneNumber: process.env.TWILIO_FROM_PHONE_NUMBER || '',
	toPhoneNumber: process.env.TWILIO_TO_PHONE_NUMBER || '',
} as const;
