import qs from 'qs';
import ejs from 'ejs';
import axios from 'axios';
import crypto from 'crypto';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import dayjsModule from 'dayjs';
import { Redis } from 'ioredis';
import { logger } from './logger';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import utc from 'dayjs/plugin/utc';
import nodemailer from 'nodemailer';
import { db, redis } from './db/db';
import { Queue, Worker, Job } from 'bullmq';
import timezone from 'dayjs/plugin/timezone';
import { appConfig, emailConfig, oauthConfig, sessionConfig } from './config';
import { GithubUserEmail, GitHubOauthToken, ApiKeyPayload, User } from './types';
import { Application, Request, Response, NextFunction } from 'express';

export function dayjs(date: string | Date = new Date()) {
	dayjsModule.extend(utc);
	dayjsModule.extend(timezone);
	return dayjsModule(date);
}

export function formatDate(date: Date, userTimezone: string = 'UTC'): string {
	return dayjs(date).tz(userTimezone).format('MM/DD/YYYY hh:mm:ss A');
}

export function secret(secretSalt: string = appConfig.secretSalt) {
	const algorithm = 'aes-256-gcm';
	const keyLength = 32;
	const encoding = 'base64url' as const;
	const key = crypto.scryptSync(secretSalt, '', keyLength);

	function encrypt(text: string): string {
		const iv = crypto.randomBytes(12);
		const cipher = crypto.createCipheriv(algorithm, key, iv);
		const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
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
		return decrypted.toString('utf8');
	}

	return { encrypt, decrypt };
}

export function setupJob<T extends Record<string, any>>(
	jobName: string,
	processJob: (job: Job<T>) => Promise<void>,
	redisConnection: Redis = redis,
) {
	const queue = new Queue<T>(jobName, { connection: redisConnection });

	new Worker<T>(jobName, processJob, { connection: redisConnection });

	return (data: T, repeat?: { cron: string }) => {
		if (repeat) {
			return queue.add(jobName, data, { repeat: { pattern: repeat.cron } });
		}
		return queue.add(jobName, data);
	};
}

export function extractDomain(req: Request): string {
	const host = req.hostname;
	const port = req.get('host')?.split(':')[1] || '';
	const protocol = process.env.APP_ENV === 'production' ? 'https' : req.protocol;
	const url = `${protocol}://${host}${port ? ':' + port : ''}`;
	return url;
}

export async function runMigrations(force: boolean = false) {
	try {
		if (appConfig.env !== 'production' && force !== true) {
			logger.info('cannot run auto database migration on non production');
			return;
		}

		const config = {
			directory: path.resolve(path.join(process.cwd(), 'dist', 'src', 'db', 'migrations')),
		};

		if (appConfig.env !== 'production') {
			config.directory = path.resolve(path.join(process.cwd(), 'src', 'db', 'migrations'));
		}

		const version = await db.migrate.currentVersion();

		logger.info(`current database version ${version}`);

		logger.info(`checking for database upgrades`);

		const [batchNo, migrations] = await db.migrate.latest(config);

		if (migrations.length === 0) {
			logger.info('database upgrade not required');
			return;
		}

		const migrationList = migrations
			.map((migration: any) => migration.split('_')[1].split('.')[0])
			.join(', ');

		logger.info(`database upgrades completed for ${migrationList} schema`);

		logger.info(`batch ${batchNo} run: ${migrations.length} migrations`);
	} catch (error) {
		logger.error('error running migrations', error);
		throw error;
	}
}

export async function getGithubOauthToken(code: string): Promise<GitHubOauthToken> {
	const rootUrl = 'https://github.com/login/oauth/access_token';

	const options = {
		client_id: oauthConfig.github.client_id,
		client_secret: oauthConfig.github.client_secret,
		code,
	};

	const queryString = qs.stringify(options);

	try {
		const { data } = await axios.post(`${rootUrl}?${queryString}`, {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		const decoded = qs.parse(data) as GitHubOauthToken;

		return decoded;
	} catch (error: any) {
		logger.error('failed to fetch github oauth tokens', error);
		throw error;
	}
}

export async function getGithubUserEmails(access_token: string): Promise<GithubUserEmail[]> {
	try {
		const { data } = await axios.get<GithubUserEmail[]>('https://api.github.com/user/emails', {
			headers: {
				Authorization: `Bearer ${access_token}`,
			},
		});

		return data;
	} catch (error: any) {
		logger.error('failed to fetch github user emails', error);
		throw error;
	}
}

export async function verifyApiKey(apiKey: string): Promise<ApiKeyPayload | null> {
	try {
		const decodedApiKeyPayload = jwt.verify(apiKey, appConfig.apiKeySecret) as ApiKeyPayload;

		const app = await db('apps')
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
		logger.error('failed to verify api key ', error);
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
					logger.error('Error sending email:', err);
					reject(err);
				} else {
					logger.info(`Email sent successfully to: ${to}`);
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
	subject = '🔔 Notify',
	message,
}: {
	email: string;
	username: string;
	subject: string;
	message: string;
}) {
	try {
		const templateContent = await fsp.readFile(
			path.resolve(path.join(process.cwd(), 'src', 'views', 'emails', 'general.html')),
			'utf-8',
		);

		const html = ejs.render(templateContent, { username, message });

		await sendEmail({
			to: email,
			subject,
			html,
		});

		logger.info('email sent successfully');
	} catch (error) {
		logger.error(`failed to send email:  ${JSON.stringify(error, null, 2)}`);
		// throw error
	}
}

export const modifyUserSessionById = async (
	userId: string | number,
	updateFunction: (user: User) => User,
): Promise<{ sessionKey: string; updatedSessionData: any & User } | null> => {
	const sessionKeys = await redis.keys(`${sessionConfig.store_prefix}*`);

	for (const sessionKey of sessionKeys) {
		const sessionData = await redis.get(sessionKey);

		const parsedSessionData: any & User = JSON.parse(sessionData as string);

		if (parsedSessionData.user && parsedSessionData.user.id === userId) {
			logger.info(`Found session for user: ${JSON.stringify(parsedSessionData.user, null, 2)}`);

			parsedSessionData.user = updateFunction(parsedSessionData.user);

			await redis.set(sessionKey, JSON.stringify(parsedSessionData));

			logger.info(`Updated user data: ${JSON.stringify(parsedSessionData.user, null, 2)}`);

			return {
				sessionKey,
				updatedSessionData: parsedSessionData,
			};
		}
	}

	logger.error('No session found for user ID:', userId);
	return null;
};

export function reload({
	app,
	watch,
	options = {},
}: {
	app: Application;
	watch: { path: string; extensions: string[] }[];
	options?: { pollInterval?: number; quiet?: boolean };
}): void {
	if (appConfig.env !== 'development') return;

	const pollInterval = options.pollInterval || 50;
	const quiet = options.quiet || false;
	let changeDetected = false;
	const lastContents = new Map<string, string>();

	watch.forEach(({ path: dir, extensions }) => {
		const extensionsSet = new Set(extensions);
		fs.watch(dir, { recursive: true }, (_: fs.WatchEventType, filename: string | null) => {
			if (filename && extensionsSet.has(filename.slice(filename.lastIndexOf('.')))) {
				try {
					const fullPath = path.join(dir, filename);
					const content = fs.readFileSync(fullPath, 'utf8');

					if (content !== lastContents.get(fullPath)) {
						lastContents.set(fullPath, content);

						if (!quiet) logger.info('[reload] File changed: %s', filename);
						changeDetected = true;
					}
				} catch {
					if (!quiet) logger.debug('[reload] Error reading file: %s', filename);
				}
			}
		});
	});

	app.get('/wait-for-reload', (req: Request, res: Response) => {
		const timer = setInterval(() => {
			if (changeDetected) {
				changeDetected = false;
				clearInterval(timer);
				res.send();
			}
		}, pollInterval);

		req.on('close', () => clearInterval(timer));
	});

	const clientScript = `
	<script>
			(async function poll() {
					try {
							await fetch('/wait-for-reload');
							location.reload();
					} catch {
							location.reload();
					}
			})();
	</script>\n\t`;

	app.use((req: Request, res: Response, next: NextFunction) => {
		const originalSend = res.send.bind(res);

		res.send = function (body: any): Response {
			if (typeof body === 'string' && body.includes('</head>')) {
				body = body.replace('</head>', clientScript + '</head>');
			}
			return originalSend(body);
		};

		next();
	});
}
