import nodemailer from 'nodemailer';
import { EmailNotificationJobData } from '../email.job';

function template(message: string, details: Record<string, any> | null) {
	return `
		<h2>${message}</h2>
		<pre>${JSON.stringify(details)}</pre>
	`;
}

export async function sendEmail(data: EmailNotificationJobData): Promise<void> {
	const transporter = nodemailer.createTransport({
		host: data.config.host,
		port: data.config.port,
		auth: {
			user: data.config.auth_email,
			pass: data.config.auth_pass,
		},
	});

	try {
		await transporter.sendMail({
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
