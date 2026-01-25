import ejs from "ejs";
import crypto from "crypto";
import path from "node:path";
import jwt from "jsonwebtoken";
import { Request } from "express";
import { logger } from "./logger";
import fsp from "node:fs/promises";
import nodemailer from "nodemailer";
import { db } from "./db/db";
import { appConfig, emailConfig, oauthConfig } from "./config";
import { GithubUserEmail, GitHubOauthToken, ApiKeyPayload } from "./types";

export function formatDate(date: Date, userTimezone: string = "UTC"): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: userTimezone,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatDateLong(date: Date, userTimezone: string = "UTC"): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: userTimezone,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDatetime(date: Date, userTimezone: string = "UTC"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: userTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date).replace(",", "");
}

export function startOfNextMonth(date: Date = new Date(), userTimezone: string = "UTC"): Date {
  // Convert to timezone, get next month's first day
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: userTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === "year")!.value);
  const month = parseInt(parts.find(p => p.type === "month")!.value);

  // Next month (handle December -> January)
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00`);
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

  const params = new URLSearchParams({
    client_id: oauthConfig.github.client_id,
    client_secret: oauthConfig.github.client_secret,
    code,
  });

  try {
    const response = await fetch(`${rootUrl}?${params.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = await response.text();
    const parsed = new URLSearchParams(data);

    return { access_token: parsed.get("access_token") || "" };
  } catch (error: any) {
    logger.error({ err: error }, "failed to fetch github oauth tokens");
    throw error;
  }
}

export async function getGithubUserEmails(access_token: string): Promise<GithubUserEmail[]> {
  try {
    const response = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const data = await response.json();
    return data as GithubUserEmail[];
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
