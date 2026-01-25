import crypto from "node:crypto";
import { db } from "../db/db";
import { logger } from "../logger";
import { secret, sendGeneralEmail } from "../utils";
import { backBlaze, s3Client } from "../config";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

export interface ExportUserDataJobData {
  userId: string;
}

async function generateSignedUrl(key: string, filename: string): Promise<string> {
  logger.info({ key, filename }, "[exportUserData] Generating signed URL");

  const command = new GetObjectCommand({
    Bucket: backBlaze.bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
    ResponseContentType: "application/json",
  });

  return getSignedUrl(s3Client, command, { expiresIn: 3600 * 24 }); // 24 hours
}

export async function exportUserData(data: ExportUserDataJobData): Promise<void> {
  logger.info({ userId: data.userId }, "[exportUserData] Starting");

  try {
    const user = await db.select("*").from("users").where("id", data.userId).first();

    if (!user) {
      logger.info("[exportUserData] User does not exist. Quitting.");
      return;
    }

    if (user.export_count >= user.max_export_count_allowed) {
      logger.info({ userId: user.id }, "[exportUserData] User has reached export limit");

      await sendGeneralEmail({
        email: user.email,
        subject: "Export Limit Reached",
        username: user.username,
        message: `You have reached your limit of ${user.max_export_count_allowed} exports. Please contact support if you need additional exports.`,
      });

      return;
    }

    const apps = await db.select("*").from("apps").where("apps.user_id", user.id);

    if (!apps.length) {
      logger.info("[exportUserData] User has no apps. Quitting.");
      return;
    }

    logger.info({ count: apps.length }, "[exportUserData] Processing apps");

    const result = [];

    for (const app of apps) {
      const channels = await db
        .select("channel_types.name as channel_type_name", "app_channels.id as app_channel_id")
        .from("app_channels")
        .leftJoin("channel_types", "channel_types.id", "app_channels.channel_type_id")
        .leftJoin("apps", "apps.id", "app_channels.app_id")
        .where({ app_id: app.id, "apps.user_id": app.user_id });

      const configs = await Promise.all(
        channels.map(async (channel) => {
          const { channel_type_name, app_channel_id } = channel;

          if (["discord", "sms", "email"].includes(channel_type_name)) {
            const config = await db
              .select("*")
              .from(`${channel_type_name}_configs`)
              .where({ app_channel_id })
              .first();

            if (config) {
              // prettier-ignore
              const { created_at: _ca, updated_at: _ua, app_channel_id: _aci, id: _id, name, ...cleanedConfig } = config;

              const decryptedConfig = Object.entries(cleanedConfig).reduce((acc, [key, value]) => {
                if (typeof value === "string") {
                  acc[key] = secret().decrypt(value);
                } else {
                  acc[key] = value;
                }
                return acc;
              }, {} as any);

              decryptedConfig.name = name;

              return { channel_type_name, config: decryptedConfig };
            }
          }

          return { channel_type_name, app_channel_id };
        }),
      );

      result.push({
        name: app.name,
        url: app.url,
        description: app.description,
        is_active: app.is_active,
        configs,
      });
    }

    const filename = `user_data_${user.id}_${crypto.randomUUID()}.json`;
    const key = `exports/${filename}`;

    const uploadCommand = new PutObjectCommand({
      Bucket: backBlaze.bucket,
      Key: key,
      Body: JSON.stringify(result, null, 2),
      ContentType: "application/json",
    });

    await s3Client.send(uploadCommand);
    logger.info({ key }, "[exportUserData] File uploaded");

    await db("users").where("id", user.id).increment("export_count", 1);

    const downloadUrl = await generateSignedUrl(key, filename);

    const message = `
            <p>Your requested data export is now ready. You can download it using the following link:</p>
            <p><a href="${downloadUrl}">Download</a></p>
            <p>This link will expire in 24 hours.</p>
            <p>You have used ${user.export_count + 1} out of ${user.max_export_count_allowed} allowed exports.</p>`;

    await sendGeneralEmail({
      email: user.email,
      subject: "🎉 Your Data Export is Ready",
      username: user.username,
      message: message.trim(),
    });

    logger.info({ email: user.email }, "[exportUserData] Completed");
  } catch (error) {
    logger.error({ err: error }, "[exportUserData] Failed");
  }
}
