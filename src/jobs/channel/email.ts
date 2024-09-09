import nodemailer from 'nodemailer';
import { EmailNotificationJobData } from '../email.job';
import { secret } from '../../utils';
import { logger } from '../../logger';

function template(username: string, message: string, details: Record<string, any> | null) {
	return `
<!doctype html>
<html>
  <body>
    <div style='background-color:#fbfafa;color:#000000;font-family:"Helvetica Neue", "Arial Nova", "Nimbus Sans", Arial, sans-serif;font-size:16px;font-weight:400;letter-spacing:0.15008px;line-height:1.5;margin:0;padding:32px 0;min-height:100%;width:100%'>
      <table
        align="center"
        width="100%"
        style="margin:0 auto;max-width:600px;background-color:#FFFFFF;border-radius:5px"
        role="presentation"
        cellspacing="0"
        cellpadding="0"
        border="0"
      >
        <tbody>
          <tr style="width:100%">
            <td>
              <div style="background-color:#fbfafa;padding:16px 24px 16px 24px">
                <h1 style="font-weight:bold;text-align:center;margin:0;font-size:32px;padding:16px 24px 16px 24px">
                  <a style="text-decoration: none;" href="https://notify.jaw.dev/" target="_blank" title="notify">🔔 Notify</a>
                </h1>
              </div>
              <div style="border:1px dashed black;border-radius:5px;padding:16px 24px 16px 24px">
                <div style="font-weight:normal;padding:16px 24px 16px 24px">
                  Hello ${username},
                </div>
                <div style="font-weight:normal;padding:16px 24px 16px 24px">
                  ${message}
                </div>
                ${
									details && details.length > 0
										? `
                <div style="padding:16px 24px 16px 24px">
                  <div style="background-color:#fbfafa;border:1px dashed black;border-radius:5px;font-weight:normal;padding:16px 24px 16px 24px">
                    ${JSON.stringify(details, null, 2)}
                  </div>
                </div>
                `
										: ''
								}
              </div>
              <div style="background-color:#fbfafa;padding:16px 24px 16px 24px">
                <div style="font-weight:normal;text-align:center;padding:16px 24px 16px 24px">
                  <p>Copyright © ${new Date().getFullYear()}. Made with ❤️ by <a style="text-decoration: none" href="https://github.com/wajeht" title="https://github.com/wajeht" target="_blank">wajeht</a></p>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </body>
</html>`;
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

	const transporter = nodemailer.createTransport(config as any);

	try {
		await new Promise((resolve, reject) => {
			transporter.sendMail(
				{
					from: config.alias,
					to: config.auth.user,
					subject: data.message,
					html: template(data.username, data.message, data.details),
				},
				(err, info) => {
					if (err) {
						logger.error('Error sending email:', err);
						reject(err);
					} else {
						logger.info('Email sent successfully to:', config.auth.user);
						resolve(info);
					}
				},
			);
		});

		logger.info('email sent to:', data.config.auth_email);
	} catch (error) {
		logger.error('error while sending email:', error);
		// throw error;
	}
}
