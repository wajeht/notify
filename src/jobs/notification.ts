import crypto from "node:crypto";
import { db } from "../db/db";
import { logger } from "../logger";
import { sendSms } from "./sms";
import { sendEmail } from "./email";
import { sendDiscord } from "./discord";
import { sendGeneralEmail } from "../utils";
import { enqueue, type JobType } from "../queue";

export interface NotificationJobData {
  userId: number;
  appId: string;
  message: string;
  details: Record<string, unknown>;
}

export async function sendNotification(data: NotificationJobData) {
  try {
    const { appId, userId, message, details } = data;

    const app = await db("apps").where({ id: appId, is_active: true, user_id: userId }).first();

    if (!app) {
      logger.info("[sendNotification] Cannot find active app. Quitting notification job");
      return;
    }

    const user = await db.select("*").from("users").where({ id: userId }).first();

    if (user.is_admin === false) {
      if (app.max_monthly_alerts_allowed === app.alerts_sent_this_month) {
        logger.info("[sendNotification] Monthly quota reached");

        await sendGeneralEmail({
          email: user.email,
          subject: `Monthly Quota Reached on ${app.name} 🔔 Notify`,
          username: user.username,
          message: `You have reached your monthly notification quota for the app "${app.name}". Notifications will continue to be available in the app, but we will stop sending them to your channels. Please wait until next month to resume channel notifications. Thank you for using Notify!`,
        });

        return;
      }

      if (app.user_monthly_limit_threshold === app.alerts_sent_this_month) {
        logger.info("[sendNotification] Custom alert limit reached");

        await sendGeneralEmail({
          email: user.email,
          subject: `Custom Alert Limit Reached on ${app.name} 🔔 Notify`,
          username: user.username,
          message: `You have reached your custom notification limit for the app "${app.name}". Notifications will continue to be available in the app, but we will stop sending them to your channels until you update your limit in your settings. Thank you for using Notify!`,
        });

        return;
      }
    }

    const appChannels = await db("app_channels")
      .join("channel_types", "app_channels.channel_type_id", "channel_types.id")
      .where({ "app_channels.app_id": appId, "app_channels.is_active": true })
      .select("channel_types.name as channel_type", "app_channels.id as app_channel_id");

    if (!appChannels.length) {
      logger.info({ appId: app.id }, "[sendNotification] no active channels for app");
      return;
    }

    // Collect all channel configs
    const channelJobs: { type: JobType; config: any; username: string }[] = [];

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
          logger.info(
            { channelType: channel.channel_type },
            "[sendNotification] Unknown channel type",
          );
          continue;
      }

      for (const config of configs) {
        channelJobs.push({ type: channel.channel_type as JobType, config, username: user.username });
      }
    }

    // Try to send immediately, queue failures for retry
    for (const job of channelJobs) {
      const success = await tryDispatch(job.type, job.config, job.username, message, details);
      if (!success) {
        // Queue for retry
        await enqueue(job.type, {
          config: job.config,
          username: job.username,
          message,
          details,
        });
      }
    }

    await db("notifications").insert({
      id: crypto.randomUUID(),
      app_id: appId,
      message: message,
      details: details,
    });

    await db("apps")
      .update({ alerts_sent_this_month: app.alerts_sent_this_month + 1 })
      .where({ id: appId, user_id: userId });

    logger.info({ appId }, "[sendNotification] notifications dispatched for app");
  } catch (error) {
    logger.error({ err: error }, "[sendNotification] error in sendNotification");
  }
}

// Try to send immediately, return success status
async function tryDispatch(
  channelType: JobType,
  config: any,
  username: string,
  message: string,
  details: any,
): Promise<boolean> {
  try {
    switch (channelType) {
      case "discord":
        await sendDiscord({ config, message, details });
        break;
      case "email":
        await sendEmail({ config, username, message, details });
        break;
      case "sms":
        await sendSms({ config, message, details });
        break;
      default:
        logger.info({ channelType }, "[sendNotification] Unsupported channel type");
        return false;
    }
    return true;
  } catch (error) {
    logger.error({ channelType, err: error }, "[sendNotification] Failed, will queue for retry");
    return false;
  }
}
