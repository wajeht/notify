import crypto from "node:crypto";
import { db } from "../db/db";
import { logger } from "../logger";
import { enqueue, type JobType } from "../queue";

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

  // Queue jobs for each channel config
  for (const channel of appChannels) {
    let configs;

    switch (channel.channel_type) {
      case "discord":
        configs = await db("discord_configs").where({ app_channel_id: channel.app_channel_id });
        break;
      case "sms":
        configs = await db("sms_configs").where({ app_channel_id: channel.app_channel_id });
        break;
      case "email":
        configs = await db("email_configs").where({ app_channel_id: channel.app_channel_id });
        break;
      default:
        continue;
    }

    for (const config of configs) {
      await enqueue(channel.channel_type as JobType, {
        config,
        username: user.username,
        message,
        details,
      });
    }
  }

  logger.info("[sendNotification] queued", { appId });
}
