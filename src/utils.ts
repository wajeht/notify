import path from 'node:path';
import { db } from './db/db';
import { appConfig } from './config';

export async function seedDatabase() {
	try {
		if (appConfig.env === 'production') {
			console.log('Cannot run database seeding in production environment');
			return;
		}

		console.log('Starting database seeding...');

		const config = {
			directory: path.resolve(path.join(process.cwd(), 'dist', 'src', 'db', 'seeds')),
		};

		const [seedFiles] = await db.seed.run(config);

		if (seedFiles.length === 0) {
			console.log('No seed files found or all seeds have already been run');
		} else {
			const seedList = seedFiles.map((seedFile: string) => path.basename(seedFile)).join(', ');
			console.log(`Database seeding completed for: ${seedList}`);
		}
	} catch (error) {
		console.error('Error seeding database:', error);
		throw error;
	}
}

export async function cleanDatabase() {
	try {
		// Get all table names in the current schema
		const tables = await db.raw(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = current_schema()
    `);
		const tableNames = tables.rows.map((row: any) => row.tablename);

		// Disable triggers
		await db.raw('SET session_replication_role = replica');

		// Truncate all tables
		for (const tableName of tableNames) {
			await db.raw(`TRUNCATE TABLE "${tableName}" CASCADE`);
			console.log(`Table ${tableName} truncated`);
		}

		console.log('All tables have been cleaned');
	} catch (error) {
		console.error('Error cleaning database:', error);
		throw error;
	} finally {
		// Re-enable triggers
		await db.raw('SET session_replication_role = DEFAULT');
	}
}

export async function runFreshMigration(force: boolean = false) {
	try {
		// if (appConfig.env === 'production' && !force) {
		// 	console.log('Cannot run fresh migration on production environment without force flag');
		// 	return;
		// }

		const config = {
			directory: path.resolve(path.join(process.cwd(), 'dist', 'src', 'db', 'migrations')),
		};

		console.log('Dropping all tables...');
		await dropAllTables();

		console.log('Running fresh migrations...');
		const [batchNo, migrations] = await db.migrate.latest(config);

		if (migrations.length === 0) {
			console.log('No migrations were run. Database schema is up to date.');
		} else {
			const migrationList = migrations
				.map((migration: any) => migration.split('_')[1].split('.')[0])
				.join(', ');
			console.log(`Fresh migrations completed for ${migrationList} schema`);
			console.log(`Batch ${batchNo} run: ${migrations.length} migrations`);
		}

		const currentVersion = await db.migrate.currentVersion();
		console.log(`Current database version: ${currentVersion}`);
	} catch (error) {
		console.error('Error running fresh migration:', error);
		throw error;
	}
}

async function dropAllTables() {
	const tables = await db.raw(`
        SELECT tablename FROM pg_tables
        WHERE schemaname = current_schema()
        AND tablename != 'knex_migrations'
        AND tablename != 'knex_migrations_lock'
    `);

	await db.raw('SET session_replication_role = replica');

	for (const row of tables.rows) {
		const tableName = row.tablename;
		try {
			await db.schema.dropTableIfExists(tableName);
			console.log(`Dropped table: ${tableName}`);
		} catch (error) {
			console.warn(`Failed to drop table ${tableName}:`, error);
		}
	}

	await db.raw('SET session_replication_role = DEFAULT');
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
