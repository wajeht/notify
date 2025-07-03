import knex from 'knex';
import knexConfig from './knexfile';
import { attachPaginate } from 'knex-paginate';

function _createKnexInstance() {
	const db = knex(knexConfig);
	attachPaginate();
	return db;
}

export const db = _createKnexInstance();

export { redis } from './redis';
