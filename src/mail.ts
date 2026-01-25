import { Eta } from "eta";
import path from "node:path";
import fsp from "node:fs/promises";
import nodemailer from "nodemailer";

import { emailConfig } from "./config";
import type { LoggerType } from "./logger";

export interface MailType {
  sendEmail: (params: { to: string; subject: string; html: string }) => Promise<void>;
  sendGeneralEmail: (params: {
    email: string;
    username: string;
    subject: string;
    message: string;
  }) => Promise<void>;
}

export function createMail(logger: LoggerType): MailType {
  const transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    auth: {
      user: emailConfig.auth.user,
      pass: emailConfig.auth.pass,
    },
  });

  async function sendEmail({
    to,
    subject,
    html,
  }: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    try {
      await new Promise((resolve, reject) => {
        transporter.sendMail({ from: emailConfig.alias, to, subject, html }, (err, info) => {
          if (err) {
            logger.error("Error sending email", err);
            reject(err);
          } else {
            logger.info("Email sent successfully", { to });
            resolve(info);
          }
        });
      });
    } catch (error) {
      logger.error(`Error while sending email:  ${JSON.stringify(error, null, 2)}`);
      throw error;
    }
  }

  async function sendGeneralEmail({
    email,
    username,
    subject = "🔔 Notify",
    message,
  }: {
    email: string;
    username: string;
    subject: string;
    message: string;
  }): Promise<void> {
    try {
      const templateContent = await fsp.readFile(
        path.resolve(path.join(process.cwd(), "src", "routes", "_emails", "general.html")),
        "utf-8",
      );

      const eta = new Eta({ useWith: true });
      const html = eta.renderString(templateContent, { username, message });

      await sendEmail({
        to: email,
        subject,
        html,
      });

      logger.info("email sent successfully");
    } catch (error) {
      logger.error(`failed to send email:  ${JSON.stringify(error, null, 2)}`);
    }
  }

  return {
    sendEmail,
    sendGeneralEmail,
  };
}
