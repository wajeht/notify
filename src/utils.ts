import path from 'node:path';
import { db } from './db/db';
import { appConfig } from './config';

export async function cleanDatabase() {
	try {
		await db.raw('SET FOREIGN_KEY_CHECKS = 0');

		const tables = await db.raw('SHOW TABLES');
		const tableNames = tables[0].map((table: any) => Object.values(table)[0]);

		for (const tableName of tableNames) {
			await db(tableName).truncate();
			console.log(`Table ${tableName} truncated`);
		}

		await db.raw('SET FOREIGN_KEY_CHECKS = 1');

		console.log('All tables have been cleaned');
	} catch (error) {
		console.error('Error cleaning database:', error);
		throw error;
	} finally {
		// await db.destroy();
	}
}

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
		} else {
			const migrationList = migrations
				.map((migration: any) => migration.split('_')[1].split('.')[0])
				.join(', ');
			console.log(`Database upgrades completed for ${migrationList} schema`);
			console.log(`Batch ${batchNo} run: ${migrations.length} migrations`);
		}
	} catch (error) {
		console.error('Error running migrations:', error);
		throw error;
	}
}
