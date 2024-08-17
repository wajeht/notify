export type Env = 'production' | 'development' | 'testing';

export interface GitHubUser {
	login: string;
	avatar_url: string;
	name: string;
	email: string;
}

export type Email = {
	email: string;
	primary: boolean;
	verified: boolean;
	visibility: string | null;
};

export type GitHubOauthToken = {
	access_token: string;
};
