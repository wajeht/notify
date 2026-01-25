import qs from "qs";
import ejs from "ejs";
import axios from "axios";
import crypto from "crypto";
import path from "node:path";
import jwt from "jsonwebtoken";
import dayjsModule from "dayjs";
import { Request } from "express";
import { logger } from "./logger";
import fsp from "node:fs/promises";
import utc from "dayjs/plugin/utc";
import nodemailer from "nodemailer";
import { db } from "./db/db";
import timezone from "dayjs/plugin/timezone";
import { appConfig, emailConfig, oauthConfig } from "./config";
import { GithubUserEmail, GitHubOauthToken, ApiKeyPayload } from "./types";

export function dayjs(date: string | Date = new Date()) {
  dayjsModule.extend(utc);
  dayjsModule.extend(timezone);
  return dayjsModule(date);
}

export function formatDate(date: Date, userTimezone: string = "UTC"): string {
  return dayjs(date).tz(userTimezone).format("MM/DD/YYYY hh:mm:ss A");
}

export function secret(secretSalt: string = appConfig.secretSalt) {
  const algorithm = "aes-256-gcm";
  const keyLength = 32;
  const encoding = "base64url" as const;
  const key = crypto.scryptSync(secretSalt, "", keyLength);

  function encrypt(text: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString(encoding);
  }

  function decrypt(encryptedText: string): string {
    const buffer = Buffer.from(encryptedText, encoding);
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  }

  return { encrypt, decrypt };
}

export function extractDomain(req: Request): string {
  const host = req.hostname;
  const port = req.get("host")?.split(":")[1] || "";
  const protocol = process.env.APP_ENV === "production" ? "https" : req.protocol;
  const url = `${protocol}://${host}${port ? ":" + port : ""}`;
  return url;
}

export async function runMigrations(force: boolean = false) {
  try {
    if (appConfig.env !== "production" && force !== true) {
      logger.info("cannot run auto database migration on non production");
      return;
    }

    const config = {
      directory: path.resolve(path.join(process.cwd(), "dist", "src", "db", "migrations")),
    };

    if (appConfig.env !== "production") {
      config.directory = path.resolve(path.join(process.cwd(), "src", "db", "migrations"));
    }

    const version = await db.migrate.currentVersion();

    logger.info(`current database version ${version}`);

    logger.info(`checking for database upgrades`);

    const [batchNo, migrations] = await db.migrate.latest(config);

    if (migrations.length === 0) {
      logger.info("database upgrade not required");
      return;
    }

    const migrationList = migrations
      .map((migration: any) => migration.split("_")[1].split(".")[0])
      .join(", ");

    logger.info(`database upgrades completed for ${migrationList} schema`);

    logger.info(`batch ${batchNo} run: ${migrations.length} migrations`);
  } catch (error) {
    logger.error({ err: error }, "error running migrations");
    throw error;
  }
}

export async function getGithubOauthToken(code: string): Promise<GitHubOauthToken> {
  const rootUrl = "https://github.com/login/oauth/access_token";

  const options = {
    client_id: oauthConfig.github.client_id,
    client_secret: oauthConfig.github.client_secret,
    code,
  };

  const queryString = qs.stringify(options);

  try {
    const { data } = await axios.post(`${rootUrl}?${queryString}`, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const decoded = qs.parse(data) as GitHubOauthToken;

    return decoded;
  } catch (error: any) {
    logger.error({ err: error }, "failed to fetch github oauth tokens");
    throw error;
  }
}

export async function getGithubUserEmails(access_token: string): Promise<GithubUserEmail[]> {
  try {
    const { data } = await axios.get<GithubUserEmail[]>("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    return data;
  } catch (error: any) {
    logger.error({ err: error }, "failed to fetch github user emails");
    throw error;
  }
}

export async function verifyApiKey(apiKey: string): Promise<ApiKeyPayload | null> {
  try {
    const decodedApiKeyPayload = jwt.verify(apiKey, appConfig.apiKeySecret) as ApiKeyPayload;

    const app = await db("apps")
      .where({
        id: decodedApiKeyPayload.appId,
        user_id: decodedApiKeyPayload.userId,
        api_key: apiKey,
        is_active: true,
        api_key_version: decodedApiKeyPayload.apiKeyVersion,
      })
      .first();

    if (!app) return null;

    return decodedApiKeyPayload;
  } catch (error) {
    logger.error({ err: error }, "failed to verify api key");
    return null;
  }
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  try {
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      auth: {
        user: emailConfig.auth.user,
        pass: emailConfig.auth.pass,
      },
    });

    await new Promise((resolve, reject) => {
      transporter.sendMail({ from: emailConfig.alias, to, subject, html }, (err, info) => {
        if (err) {
          logger.error({ err }, "Error sending email");
          reject(err);
        } else {
          logger.info({ to }, "Email sent successfully");
          resolve(info);
        }
      });
    });
  } catch (error) {
    logger.error(`Error while sending email:  ${JSON.stringify(error, null, 2)}`);
    throw error;
  }
}

export async function sendGeneralEmail({
  email,
  username,
  subject = "🔔 Notify",
  message,
}: {
  email: string;
  username: string;
  subject: string;
  message: string;
}) {
  try {
    const templateContent = await fsp.readFile(
      path.resolve(path.join(process.cwd(), "src", "views", "emails", "general.html")),
      "utf-8",
    );

    const html = ejs.render(templateContent, { username, message });

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
