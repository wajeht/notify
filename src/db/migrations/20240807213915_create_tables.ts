import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema
		.createTable('users', (table) => {
			table.increments('id').primary();
			table.string('username').unique().notNullable();
			table.string('email').unique().notNullable();
			table.boolean('is_admin').defaultTo(false);
			table.timestamps(true, true);

			table.index('email');
		})
		.createTable('apps', (table) => {
			table.increments('id').primary();
			table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
			table.string('name').notNullable();
			table.timestamps(true, true);

			table.index('user_id');
			table.index('name');
		})
		.createTable('channel_types', (table) => {
			table.increments('id').primary();
			table.string('name').unique().notNullable();
			table.timestamps(true, true);

			table.index('name');
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
			table.string('name').notNullable();
			table.boolean('is_active').defaultTo(true);
			table.timestamps(true, true);

			table.index('app_id');
			table.index('channel_type_id');
			table.index('is_active');
			table.unique(['app_id', 'name']);
		})
		.createTable('email_configs', (table) => {
			table
				.integer('app_channel_id')
				.unsigned()
				.references('id')
				.inTable('app_channels')
				.onDelete('CASCADE')
				.primary();
			table.string('host').notNullable();
			table.integer('port').notNullable();
			table.string('alias').notNullable();
			table.string('auth_email').notNullable();
			table.string('auth_pass').notNullable();

			table.index('host');
			table.index('auth_email');
		})
		.createTable('sms_configs', (table) => {
			table
				.integer('app_channel_id')
				.unsigned()
				.references('id')
				.inTable('app_channels')
				.onDelete('CASCADE')
				.primary();
			table.string('account_sid').notNullable();
			table.string('auth_token').notNullable();
			table.string('from_phone_number').notNullable();
			table.string('phone_number').notNullable();

			table.index('account_sid');
			table.index('from_phone_number');
			table.index('phone_number');
		})
		.createTable('discord_configs', (table) => {
			table
				.integer('app_channel_id')
				.unsigned()
				.references('id')
				.inTable('app_channels')
				.onDelete('CASCADE')
				.primary();
			table.string('webhook_url').notNullable();
			table.index('webhook_url');
		})
		.createTable('notifications', (table) => {
			table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
			table.integer('app_id').unsigned().references('id').inTable('apps').onDelete('CASCADE');
			table.text('message').notNullable();
			table.jsonb('details').nullable();
			table.timestamps(true, true);

			table.index('app_id');
			table.index('created_at');
		})
		.createTable('jobs', (table) => {
			table.increments('id').primary();
			table.uuid('notification_id').references('id').inTable('notifications').onDelete('CASCADE');
			table
				.integer('app_channel_id')
				.unsigned()
				.references('id')
				.inTable('app_channels')
				.onDelete('CASCADE');
			table
				.enu('status', ['pending', 'processing', 'completed', 'failed', 'retrying'])
				.notNullable()
				.defaultTo('pending');
			table.integer('attempts').defaultTo(0);
			table.timestamp('processed_at').nullable();
			table.text('error_message').nullable();
			table.jsonb('result').nullable();
			table.timestamps(true, true);

			table.index('notification_id');
			table.index('app_channel_id');
			table.index('status');
			table.index('created_at');
			table.index('attempts');
		});

	// Insert default channel types
	await knex('channel_types').insert([{ name: 'email' }, { name: 'sms' }, { name: 'discord' }]);
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema
		.dropTableIfExists('jobs')
		.dropTableIfExists('notifications')
		.dropTableIfExists('discord_configs')
		.dropTableIfExists('sms_configs')
		.dropTableIfExists('email_configs')
		.dropTableIfExists('app_channels')
		.dropTableIfExists('channel_types')
		.dropTableIfExists('apps')
		.dropTableIfExists('users');
}
