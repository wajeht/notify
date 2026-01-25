import crypto from "node:crypto";
import { db } from "./db/db";
import { logger } from "./logger";
import { secret } from "./utils";
import { DiscordConfig } from "./types";
import nodemailer from "nodemailer";
import { EmailConfig } from "./types";
import twilio from "twilio";
import { SmsConfig } from "./types";

export interface NotificationJobData {
  userId: number;
  appId: string;
  message: string;
  details: Record<string, unknown>;
}

export interface SmsNotificationData {
  config: SmsConfig;
  message: string;
  details: Record<string, any> | null;
}

export async function sendSms(data: SmsNotificationData): Promise<void> {
  const client = twilio(data.config.account_sid, data.config.auth_token);

  const message = await client.messages.create({
    body: `${data.message}\n\n${JSON.stringify(data.details)}`,
    from: data.config.from_phone_number,
    to: data.config.phone_number,
  });

  logger.info("[sendSms] SMS sent", { sid: message.sid });
}

export interface EmailNotificationData {
  config: EmailConfig;
  username: string;
  message: string;
  details: Record<string, any> | null;
}

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
                  details && Object.keys(details).length > 0
                    ? `
                <div style="padding:16px 24px 16px 24px">
                  <div style="background-color:#fbfafa;border:1px dashed black;border-radius:5px;font-weight:normal;padding:16px 24px 16px 24px">
                    ${JSON.stringify(details, null, 2)}
                  </div>
                </div>
                `
                    : ""
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

export async function sendEmail(data: EmailNotificationData): Promise<void> {
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
          const errWithCode = err as Error & { code?: string };
          const isConnectionError =
            errWithCode.code === "EDNS" ||
            errWithCode.code === "ECONNREFUSED" ||
            errWithCode.code === "ETIMEDOUT";
          if (isConnectionError) {
            logger.warn("[sendEmail] Mail server unavailable, will retry", {
              host: config.host,
              code: errWithCode.code,
            });
          } else {
            logger.error("[sendEmail] Failed to send email", err);
          }
          reject(err);
        } else {
          logger.info("[sendEmail] Email sent", { to: config.auth.user });
          resolve(info);
        }
      },
    );
  });
}

export interface DiscordNotificationData {
  config: DiscordConfig;
  message: string;
  details: Record<string, unknown> | null;
}

type Params = {
  username: string;
  content: string;
  embeds?: Array<{ title: string; description: string }>;
};

export async function sendDiscord(data: DiscordNotificationData): Promise<void> {
  const params: Params = {
    username: "notify.jaw.dev",
    content: data.message,
  };

  if (data.details) {
    params.embeds = [
      {
        title: data.message,
        description: JSON.stringify(data.details),
      },
    ];
  }

  const res = await fetch(secret().decrypt(data.config.webhook_url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (res.status === 204) {
    logger.info("[sendDiscord] Discord notification sent", { message: data.message });
  } else {
    const error = new Error(`Discord webhook failed with status ${res.status}`);
    logger.warn("[sendDiscord] Discord webhook failed, will retry", { status: res.status });
    throw error;
  }
}

export async function sendNotification(data: NotificationJobData) {
  const { appId, userId, message, details } = data;

  const app = await db("apps").where({ id: appId, is_active: true, user_id: userId }).first();

  if (!app) {
    throw new Error(`App ${appId} not found or inactive`);
  }

  const user = await db.select("*").from("users").where({ id: userId }).first();

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  // Save the notification to the database
  await db("notifications").insert({
    id: crypto.randomUUID(),
    app_id: appId,
    message,
    details: details ? JSON.stringify(details) : null,
  });

  // Get active channels
  const appChannels = await db("app_channels")
    .join("channel_types", "app_channels.channel_type_id", "channel_types.id")
    .where({ "app_channels.app_id": appId, "app_channels.is_active": true })
    .select("channel_types.name as channel_type", "app_channels.id as app_channel_id");

  if (!appChannels.length) {
    logger.info("[sendNotification] no active channels", { appId });
    return;
  }

  // Send to each channel (fire-and-forget)
  for (const channel of appChannels) {
    let configs;

    switch (channel.channel_type) {
      case "discord":
        configs = await db("discord_configs").where({ app_channel_id: channel.app_channel_id });
        for (const config of configs) {
          sendDiscord({ config, message, details }).catch((err) =>
            logger.error("[sendNotification] discord failed", err),
          );
        }
        break;
      case "sms":
        configs = await db("sms_configs").where({ app_channel_id: channel.app_channel_id });
        for (const config of configs) {
          sendSms({ config, message, details }).catch((err) =>
            logger.error("[sendNotification] sms failed", err),
          );
        }
        break;
      case "email":
        configs = await db("email_configs").where({ app_channel_id: channel.app_channel_id });
        for (const config of configs) {
          sendEmail({ config, username: user.username, message, details }).catch((err) =>
            logger.error("[sendNotification] email failed", err),
          );
        }
        break;
    }
  }

  logger.info("[sendNotification] dispatched", { appId });
}
