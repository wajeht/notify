import knex from 'knex';
import knexConfig from './knexfile';

export { redis } from './redis';
export const db = knex(knexConfig);
