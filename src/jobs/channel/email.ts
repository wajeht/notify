import nodemailer from 'nodemailer';
import { EmailNotificationJobData } from '../email.job';
import { secret } from '../../utils';

function template(message: string, details: Record<string, any> | null) {
	return `
		<h2>${message}</h2>
		<pre>${JSON.stringify(details)}</pre>
	`;
}

export async function sendEmail(data: EmailNotificationJobData): Promise<void> {
	const config = {
		host: secret().decrypt(data.config.host),
		port: secret().decrypt(data.config.port),
		alias: secret().decrypt(data.config.alias),
		auth: {
			user: secret().decrypt(data.config.auth_email),
			pass: secret().decrypt(data.config.auth_pass),
		},
	};

	// @ts-expect-error - trust me bro
	const transporter = nodemailer.createTransport(config);

	try {
		await transporter.sendMail({
			from: config.alias,
			to: config.auth.user,
			subject: data.message,
			html: template(data.message, data.details),
		});

		console.info('email sent to:', data.config.auth_email);
	} catch (error) {
		console.error('error while sending email:', error);
		// throw error;
	}
}
