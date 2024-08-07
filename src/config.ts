import path from 'path';
import dotenv from 'dotenv';
import { Env } from "./types";

dotenv.config({ path: path.resolve(path.join(process.cwd(), '.env')) });

export const appConfig = {
  port: process.env.PORT as unknown as number || 80,
  env: process.env.ENV as unknown as Env || 'development'
} as const

export const emailConfig ={
	host: process.env.EMAIL_HOST as string,
	port: process.env.EMAIL_PORT as unknown as number,
	email_alias: process.env.EMAIL_AUTH_ALIAS as unknown as string,
	auth: {
		user: process.env.EMAIL_AUTH_EMAIL  as unknown as string,
		pass: process.env.EMAIL_AUTH_PASS as unknown as string,
	},
} as const;
