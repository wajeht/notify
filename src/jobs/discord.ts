import { secret } from "../utils";
import { logger } from "../logger";
import { DiscordConfig } from "../types";

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
    logger.info({ message: data.message }, "[sendDiscord] Discord notification sent");
  } else {
    const error = new Error(`Discord webhook failed with status ${res.status}`);
    logger.warn({ status: res.status }, "[sendDiscord] Discord webhook failed, will retry");
    throw error;
  }
}
