import { EmailConfig } from '../types';

export interface EmailNotificationJobData {
	config: EmailConfig;
	username: string;
	message: string;
	details: Record<string, any> | null;
}

export { sendEmail } from './channel/email';
