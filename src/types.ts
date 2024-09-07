declare module 'express-session' {
	interface SessionData {
		user?: User;
		input?: Record<string, unknown>;
		errors?: Record<string, unknown>;
	}
}

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Express {
		interface Request {
			apiKeyPayload?: ApiKeyPayload;
		}
	}
}

export type Env = 'production' | 'development' | 'testing';

export type ApiKeyPayload = {
	appId: string;
	userId: string;
	apiKeyVersion: number;
};

export interface GitHubUser {
	login: string;
	avatar_url: string;
	name: string;
	email: string;
}

export type GithubUserEmail = {
	email: string;
	primary: boolean;
	verified: boolean;
	visibility: string | null;
};

export type GitHubOauthToken = {
	access_token: string;
};

export type User = {
	id: number;
	username: string;
	timezone: string;
	email: string;
	is_admin: boolean;
	created_at: string;
	updated_at: string;
};

export type EmailConfig = {
	id: number;
	app_channel_id: number;
	name: string;
	host: string;
	port: string;
	alias: string;
	auth_email: string;
	auth_pass: string;
	created_at: string;
	updated_at: string;
};

export type SmsConfig = {
	id: number;
	app_channel_id: number;
	name: string;
	account_sid: string;
	auth_token: string;
	from_phone_number: string;
	phone_number: string;
	created_at: string;
	updated_at: string;
};

export type DiscordConfig = {
	id: number;
	app_channel_id: number;
	name: string;
	webhook_url: string;
	created_at: string;
	updated_at: string;
};
