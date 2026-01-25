import path from "path";
import dotenv from "dotenv";
import { Env } from "./types";

dotenv.config({ path: path.resolve(path.join(process.cwd(), ".env")) });

export const appConfig = {
  port: parseInt(process.env.APP_PORT || "8080", 10),
  env: (process.env.APP_ENV as Env) || "development",
  appUrl: process.env.APP_URL || "",
  adminEmail: process.env.APP_ADMIN_EMAIL || "",
  apiKeySecret: process.env.APP_API_KEY_SECRET || "notify",
  secretSalt: process.env.APP_SECRET_SALT || "notify",
} as const;

export const emailConfig = {
  host: process.env.EMAIL_HOST || "",
  port: parseInt(process.env.EMAIL_PORT || "0", 10),
  alias: process.env.EMAIL_ALIAS || "",
  auth: {
    user: process.env.EMAIL_AUTH_EMAIL || "",
    pass: process.env.EMAIL_AUTH_PASS || "",
  },
} as const;

export const smsConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID || "",
  authToken: process.env.TWILIO_AUTH_TOKEN || "",
  fromPhoneNumber: process.env.TWILIO_FROM_PHONE_NUMBER || "",
  toPhoneNumber: process.env.TWILIO_TO_PHONE_NUMBER || "",
} as const;

export const oauthConfig = {
  github: {
    redirect_uri: process.env.GITHUB_REDIRECT_URI || "http://localhost/oauth/github/redirect",
    client_id: process.env.GITHUB_CLIENT_ID || "",
    client_secret: process.env.GITHUB_CLIENT_SECRET || "",
  },
} as const;

export const sessionConfig = {
  store_prefix: process.env.SESSION_STORE_PREFIX || "notify",
  secret: process.env.SESSION_SECRET || "notify",
  domain: process.env.SESSION_DOMAIN || "localhost",
} as const;
