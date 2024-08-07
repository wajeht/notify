import type { Knex } from 'knex';
import path from 'node:path';
import { databaseConfig, appConfig } from '../config';

const developmentEnvironmentOnly = appConfig.env === 'development';

const knexConfig: Knex.Config = {
	client: 'pg',
	connection: {
		host: databaseConfig.host,
		user: databaseConfig.username,
		password: databaseConfig.password,
		database: databaseConfig.database,
	},
	migrations: {
		extension: 'ts',
		tableName: 'knex_migrations',
		directory: path.resolve(__dirname, './migrations'),
	},
	debug: developmentEnvironmentOnly,
	seeds: { directory: path.resolve(__dirname, './seeds') },
	pool: {
		min: 2,
		max: 10,
	},
};

if (appConfig.env === 'testing') {
	knexConfig.connection = {
		filename: ':memory:',
	};
}

export default knexConfig;
