import ejs from "ejs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import path from "node:path";
import { Request } from "express";
import { logger } from "./logger";
import fsp from "node:fs/promises";
import nodemailer from "nodemailer";
import { db } from "./db/db";
import { appConfig, emailConfig, oauthConfig } from "./config";
import { GithubUserEmail, GitHubOauthToken, ApiKeyPayload } from "./types";

export function formatDate(date: Date | string | null, userTimezone: string = "UTC"): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: userTimezone,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatDatetime(date: Date | string | null, userTimezone: string = "UTC"): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: userTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(",", "");
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
    logger.error("failed to fetch github oauth tokens", error);
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
    logger.error("failed to fetch github user emails", error);
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
    logger.error("failed to verify api key", error);
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
          logger.error("Error sending email", err);
          reject(err);
        } else {
          logger.info("Email sent successfully", { to });
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
      path.resolve(path.join(process.cwd(), "src", "routes", "_emails", "general.html")),
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
