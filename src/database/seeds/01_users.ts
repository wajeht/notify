import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';
import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
	await knex('users').del();

	const users = [];
	const saltRounds = 10;

	for (let i = 0; i < 5; i++) {
		const user = {
			email: faker.internet.email(),
			password: await bcrypt.hash('password', saltRounds),
			is_verified: faker.datatype.boolean(),
			verification_token: faker.datatype.boolean() ? faker.string.uuid() : null,
			verification_token_expires_at: faker.date.future(),
			reset_password_token: faker.datatype.boolean() ? faker.string.uuid() : null,
			reset_password_token_expires_at: faker.date.future(),
			created_at: faker.date.past(),
			updated_at: faker.date.recent(),
		};

		users.push(user);
	}

	await knex('users').insert(users);
}
