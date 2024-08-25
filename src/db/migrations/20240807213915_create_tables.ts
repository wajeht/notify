import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema
		.createTable('users', (table) => {
			table.increments('id').primary();
			table.string('username').unique().notNullable();
			table.string('email').unique().notNullable();
			table.boolean('is_admin').defaultTo(false);
			table.integer('max_apps_allowed').defaultTo(5);
			table.timestamps(true, true);

			table.index(['email', 'is_admin']);
		})
		.createTable('apps', (table) => {
			table.increments('id').primary();
			table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
			table.string('name').notNullable();
			table.string('url').nullable();
			table.string('description').nullable();
			table.boolean('is_active').defaultTo(true);
			table.string('api_key').unique().nullable();
			table.integer('api_key_version').defaultTo(0).notNullable();
			table.timestamp('api_key_created_at').nullable();

			table.integer('max_monthly_alerts_allowed').defaultTo(100);
			table.integer('user_monthly_limit_threshold').defaultTo(null);
			table.integer('alerts_sent_this_month').defaultTo(0);
			table.date('alerts_reset_date').defaultTo(knex.fn.now());

			table.timestamps(true, true);

			table.index(['user_id', 'is_active']);
			table.index('api_key');
			table.index(['name', 'is_active']);
		})
		.createTable('channel_types', (table) => {
			table.increments('id').primary();
			table.string('name').unique().notNullable();
			table.timestamps(true, true);
		})
		.createTable('app_channels', (table) => {
			table.increments('id').primary();
			table.integer('app_id').unsigned().references('id').inTable('apps').onDelete('CASCADE');
			table
				.integer('channel_type_id')
				.unsigned()
				.references('id')
				.inTable('channel_types')
				.onDelete('CASCADE');
			table.timestamps(true, true);

			table.index(['app_id', 'channel_type_id']);
		})
		.createTable('email_configs', (table) => {
			table.increments('id').primary();
			table
				.integer('app_channel_id')
				.unsigned()
				.references('id')
				.inTable('app_channels')
				.onDelete('CASCADE');
			table.string('name').notNullable();
			table.boolean('is_active').defaultTo(true);
			table.string('host').notNullable();
			table.string('port').notNullable();
			table.string('alias').notNullable();
			table.string('auth_email').notNullable();
			table.string('auth_pass').notNullable();
			table.timestamps(true, true);

			table.index(['app_channel_id', 'is_active']);
			table.index('auth_email');
		})
		.createTable('sms_configs', (table) => {
			table.increments('id').primary();
			table
				.integer('app_channel_id')
				.unsigned()
				.references('id')
				.inTable('app_channels')
				.onDelete('CASCADE');
			table.string('name').notNullable();
			table.boolean('is_active').defaultTo(true);
			table.string('account_sid').notNullable();
			table.string('auth_token').notNullable();
			table.string('from_phone_number').notNullable();
			table.string('phone_number').notNullable();
			table.timestamps(true, true);

			table.index(['app_channel_id', 'is_active']);
			table.index('account_sid');
			table.index('phone_number');
		})
		.createTable('discord_configs', (table) => {
			table.increments('id').primary();
			table
				.integer('app_channel_id')
				.unsigned()
				.references('id')
				.inTable('app_channels')
				.onDelete('CASCADE');
			table.string('name').notNullable();
			table.boolean('is_active').defaultTo(true);
			table.string('webhook_url').notNullable();
			table.timestamps(true, true);

			table.index(['app_channel_id', 'is_active']);
			table.index('webhook_url');
		})
		.createTable('notifications', (table) => {
			table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
			table.integer('app_id').unsigned().references('id').inTable('apps').onDelete('CASCADE');
			table.text('message').notNullable();
			table.jsonb('details').nullable();
			table.timestamps(true, true);

			table.index(['app_id', 'created_at']);
		});

	// Insert default channel types
	await knex('channel_types').insert([{ name: 'email' }, { name: 'sms' }, { name: 'discord' }]);
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema
		.dropTableIfExists('notifications')
		.dropTableIfExists('discord_configs')
		.dropTableIfExists('sms_configs')
		.dropTableIfExists('email_configs')
		.dropTableIfExists('app_channels')
		.dropTableIfExists('channel_types')
		.dropTableIfExists('apps')
		.dropTableIfExists('users');
}
