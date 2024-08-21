import nodemailer from 'nodemailer';

import { emailConfig, appConfig } from '../../config';
import { EmailNotificationJobData } from '../email.job';

const transporter = nodemailer.createTransport(emailConfig);

function template(message: string, details: Record<string, any> | null) {
	return `
		<h2>${message}</h2>
		<pre>${JSON.stringify(details)}</pre>
	`;
}

export async function sendEmail(data: EmailNotificationJobData): Promise<void> {
	try {
		transporter.sendMail({
			from: data.config.alias,
			to: data.config.auth_email,
			subject: data.message,
			html: template(data.message, data.details),
		});

		console.info('email sent to:', data.config.auth_email);
	} catch (error) {
		console.error('error while sending email:', error);
		// throw error;
	}
}
