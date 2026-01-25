import crypto from "node:crypto";
import { db } from "../db/db";
import { logger } from "../logger";
import { sendSms } from "./sms";
import { sendEmail } from "./email";
import { sendDiscord } from "./discord";

export interface NotificationJobData {
  userId: number;
  appId: string;
  message: string;
  details: Record<string, unknown>;
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
