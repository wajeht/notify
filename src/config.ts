import path from 'path';
import dotenv from 'dotenv';
import { Env } from './types';
import { S3Client } from '@aws-sdk/client-s3';

dotenv.config({ path: path.resolve(path.join(process.cwd(), '.env')) });

export const appConfig = {
	port: parseInt(process.env.APP_PORT || '8080', 10),
	env: (process.env.APP_ENV as Env) || 'development',
	appUrl: process.env.APP_URL || '',
	adminEmail: process.env.APP_ADMIN_EMAIL || '',
	apiKeySecret: process.env.APP_API_KEY_SECRET || 'notify',
	secretSalt: process.env.APP_SECRET_SALT || 'notify',
} as const;

export const emailConfig = {
	host: process.env.EMAIL_HOST || '',
	port: parseInt(process.env.EMAIL_PORT || '0', 10),
	alias: process.env.EMAIL_ALIAS || '',
	auth: {
		user: process.env.EMAIL_AUTH_EMAIL || '',
		pass: process.env.EMAIL_AUTH_PASS || '',
	},
} as const;

export const databaseConfig = {
	port: parseInt(process.env.DB_PORT || '5432'),
	host: process.env.DB_HOST || 'postgres',
	username: process.env.DB_USERNAME || 'username',
	password: process.env.DB_PASSWORD || 'password',
	database: process.env.DB_DATABASE || 'database',
} as const;

export const redisConfig = {
	port: parseInt(process.env.REDIS_PORT || '6379'),
	host: process.env.REDIS_HOST || 'redis',
	password: process.env.REDIS_PASSWORD || '',
} as const;

export const smsConfig = {
	accountSid: process.env.TWILIO_ACCOUNT_SID || '',
	authToken: process.env.TWILIO_AUTH_TOKEN || '',
	fromPhoneNumber: process.env.TWILIO_FROM_PHONE_NUMBER || '',
	toPhoneNumber: process.env.TWILIO_TO_PHONE_NUMBER || '',
} as const;

export const oauthConfig = {
	github: {
		redirect_uri: process.env.GITHUB_REDIRECT_URI || 'http://localhost/oauth/github/redirect',
		client_id: process.env.GITHUB_CLIENT_ID || '',
		client_secret: process.env.GITHUB_CLIENT_SECRET || '',
	},
} as const;

export const sessionConfig = {
	store_prefix: process.env.SESSION_STORE_PREFIX || 'notify',
	secret: process.env.SESSION_SECRET || 'notify',
	domain: process.env.SESSION_DOMAIN || 'localhost',
} as const;

export const backBlaze = {
	bucket: process.env.BACKBLAZE_BUCKET as unknown as string,
	region: process.env.BACKBLAZE_REGION as unknown as string,
	end_point: process.env.BACKBLAZE_END_POINT as unknown as string,
	key_id: process.env.BACKBLAZE_KEY_ID as unknown as string,
	application_key: process.env.BACKBLAZE_APPLICATION_KEY as unknown as string,
} as const;

export const s3Client = new S3Client({
	credentials: {
		accessKeyId: backBlaze.key_id,
		secretAccessKey: backBlaze.application_key,
	},
	region: backBlaze.region,
	forcePathStyle: true,
	endpoint: backBlaze.end_point,
});
