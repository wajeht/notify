import twilio from "twilio";
import { logger } from "../logger";
import { SmsConfig } from "../types";

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
