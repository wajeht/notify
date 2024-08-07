import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
	await knex.schema.createTable('users', (table) => {
		table.increments('id').primary();
		table.string('email').unique().notNullable();
		table.string('password').notNullable();
		table.boolean('is_verified').defaultTo(false);
		table.string('verification_token').nullable();
		table.timestamp('verification_token_expires_at').nullable();
		table.string('reset_password_token').nullable();
		table.timestamp('reset_password_token_expires_at').nullable();
		table.timestamps(true, true);
	});
}

export async function down(knex: Knex): Promise<void> {
	await knex.schema.dropTableIfExists('users');
}
