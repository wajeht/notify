import path from 'path';
import dotenv from 'dotenv';
import { Env } from "./types";

dotenv.config({ path: path.resolve(path.join(process.cwd(), '.env')) });

export const appConfig = {
  port: process.env.PORT as unknown as number || 80,
  env: process.env.ENV as unknown as Env || 'development'
} as const
