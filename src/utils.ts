import qs from 'qs';
import axios from 'axios';
import path from 'node:path';
import { db } from './db/db';
import jwt from 'jsonwebtoken';
import { appConfig, oauthConfig } from './config';
import { GithubUserEmail, GitHubOauthToken } from './types';

export async function runMigrations(force: boolean = false) {
	try {
		if (appConfig.env !== 'production' && force !== true) {
			console.log('cannot run auto database migration on non production');
			return;
		}

		const config = {
			directory: path.resolve(path.join(process.cwd(), 'dist', 'src', 'db', 'migrations')),
		};

		if (appConfig.env !== 'production') {
			config.directory = path.resolve(path.join(process.cwd(), 'src', 'db', 'migrations'));
		}

		const version = await db.migrate.currentVersion();

		console.log(`current database version ${version}`);

		console.log(`checking for database upgrades`);

		const [batchNo, migrations] = await db.migrate.latest(config);

		if (migrations.length === 0) {
			console.log('database upgrade not required');
			return;
		}

		const migrationList = migrations
			.map((migration: any) => migration.split('_')[1].split('.')[0])
			.join(', ');

		console.log(`database upgrades completed for ${migrationList} schema`);

		console.log(`batch ${batchNo} run: ${migrations.length} migrations`);
	} catch (error) {
		console.error('error running migrations', error);
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
		console.error('failed to fetch github oauth tokens', error);
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
		console.error('failed to fetch github user emails', error);
		throw error;
	}
}

export async function verifyApiKey(
	apiKey: string,
): Promise<{ apiKey: string; userId: string } | null> {
	try {
		const decoded = jwt.verify(apiKey, appConfig.apiKeySecret) as {
			appId: string;
			userId: string;
		};

		const app = await db('apps')
			.where({ id: decoded.appId, api_key: apiKey, is_active: true })
			.first();

		if (!app) return null;

		return { apiKey: decoded.appId, userId: decoded.userId };
	} catch (error) {
		console.error('invalid api key:', error);
		return null;
	}
}
