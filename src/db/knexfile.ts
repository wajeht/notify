import type { Knex } from 'knex';
import path from 'node:path';
import { databaseConfig, appConfig } from '../config';

const developmentEnvironmentOnly = appConfig.env === 'development';

const knexConfig: Knex.Config = {
	client: 'pg',
	connection: {
		database: databaseConfig.database,
		host: databaseConfig.host,
		user: databaseConfig.username,
		password: databaseConfig.password,
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
		acquireTimeoutMillis: 60000, // Increase to 60 seconds
		createTimeoutMillis: 60000, // Increase to 60 seconds
		idleTimeoutMillis: 60000, // Increase to 60 seconds
		reapIntervalMillis: 1000, // 1 second
		afterCreate: (conn: any, done: (err: Error | null, conn: any) => void) => {
			console.info('New database connection established');
			done(null, conn);
		},
	},
};

if (appConfig.env === 'testing') {
	knexConfig.connection = {
		filename: ':memory:',
	};
}

export default knexConfig;
