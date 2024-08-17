import qs from 'qs';
import axios from 'axios';
import path from 'node:path';
import { db } from './db/db';
import { appConfig, oauthConfig } from './config';
import { Email, GitHubOauthToken, GitHubUser } from './types';

export async function runMigrations() {
	try {
		if (appConfig.env !== 'production') {
			console.log('Cannot run auto database migration on non production');
			return;
		}

		const config = {
			directory: path.resolve(path.join(process.cwd(), 'dist', 'src', 'db', 'migrations')),
		};

		const version = await db.migrate.currentVersion();

		console.log(`Current database version ${version}`);

		console.log(`Checking for database upgrades`);

		const [batchNo, migrations] = await db.migrate.latest(config);

		if (migrations.length === 0) {
			console.log('Database upgrade not required');
			return;
		}

		const migrationList = migrations
			.map((migration: any) => migration.split('_')[1].split('.')[0])
			.join(', ');

		console.log(`Database upgrades completed for ${migrationList} schema`);

		console.log(`Batch ${batchNo} run: ${migrations.length} migrations`);
	} catch (error) {
		console.error('Error running migrations:', error);
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
		console.error('failed to fetch Github Oauth Tokens', error);
		throw error;
	}
}

export async function getGithubUserEmails(access_token: string): Promise<Email[]> {
	try {
		const { data } = await axios.get<Email[]>('https://api.github.com/user/emails', {
			headers: {
				Authorization: `Bearer ${access_token}`,
			},
		});

		return data;
	} catch (error: any) {
		console.error('failed to fetch Github User emails', error);
		throw error;
	}
}
