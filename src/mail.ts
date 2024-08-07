import nodemailer from 'nodemailer';

import { emailConfig, appConfig } from './config';

const transporter = nodemailer.createTransport(emailConfig);

const domain = appConfig.app_url;

interface SendMailOptions {
  to?: string;
  subject: string;
  html: string;
  from?: string;
}

const template = `<h1>hello world</h1>`;

export async function send({
  to = `${domain} <${emailConfig.email_alias}>`,
  subject,
  html: template,
  from = `${domain} <${emailConfig.email_alias}>`,
}: SendMailOptions): Promise<void> {
  try {

    await transporter.sendMail({ from, to, subject, html: template });

    console.info('email sent to:', to);
  } catch (error) {
    console.error('error while sending email:', error);
    throw error;
  }
}
