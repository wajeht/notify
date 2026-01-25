export interface NotificationJobData {
  userId: number;
  appId: string;
  message: string;
  details: Record<string, unknown>;
}

export { sendNotification } from "./channel/notification";
