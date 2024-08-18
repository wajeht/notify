export type Env = 'production' | 'development' | 'testing';

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
	email: string;
	is_admin: boolean;
	created_at: string;
	updated_at: string;
};
