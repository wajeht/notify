import { Knex } from 'knex';
import { faker } from '@faker-js/faker';

export async function seed(knex: Knex): Promise<void> {
	await knex('notifications').del();
	await knex('discord_configs').del();
	await knex('sms_configs').del();
	await knex('email_configs').del();
	await knex('app_channels').del();
	await knex('apps').del();
	await knex('channel_types').del();
	await knex('users').del();

	// Seed users
	const users = [
		{
			username: 'admin',
			email: 'admin@example.com',
			is_admin: true,
			max_apps_allowed: 10,
			created_at: new Date(),
			updated_at: new Date(),
		},
		...Array(4)
			.fill(null)
			.map(() => ({
				username: faker.internet.userName(),
				email: faker.internet.email(),
				is_admin: false,
				max_apps_allowed: faker.number.int({ min: 1, max: 5 }),
				created_at: faker.date.past(),
				updated_at: faker.date.recent(),
			})),
	];
	const userIds = await knex('users').insert(users).returning('id');

	// Seed apps
	const apps = Array(10)
		.fill(null)
		.map(() => ({
			user_id: faker.helpers.arrayElement(userIds).id,
			name: faker.company.name(),
			url: faker.internet.url(),
			description: faker.lorem.sentences(1),
			is_active: faker.datatype.boolean(),
			api_key: faker.string.uuid(),
			api_key_version: faker.number.int({ min: 0, max: 5 }),
			api_key_created_at: faker.date.past(),
			user_monthly_limit_threshold: faker.number.int({ min: 10, max: 100 }),
			alerts_sent_this_month: faker.number.int({ min: 0, max: 50 }),
			alerts_reset_date: faker.date.recent(),
			created_at: faker.date.past(),
			updated_at: faker.date.recent(),
		}));

	const appIds = await knex('apps').insert(apps).returning('id');

	// Seed channel types
	const channelTypes = ['email', 'sms', 'discord'].map((name) => ({
		name,
		created_at: faker.date.past(),
		updated_at: faker.date.recent(),
	}));

	const channelTypeIds = await knex('channel_types').insert(channelTypes).returning('*');

	// Seed app channels
	const appChannels = appIds.flatMap((app) =>
		channelTypeIds.map((channelType) => ({
			app_id: app.id,
			channel_type_id: channelType.id,
			created_at: faker.date.past(),
			updated_at: faker.date.recent(),
		})),
	);

	const appChannelIds = await knex('app_channels').insert(appChannels).returning('id');

	// Seed email configs
	const emailChannels = await knex('app_channels')
		.whereIn(
			'id',
			appChannelIds.map((ac) => ac.id),
		)
		.whereIn(
			'channel_type_id',
			channelTypeIds.filter((ct) => ct.name === 'email').map((ct) => ct.id),
		);

	const emailConfigs = emailChannels.map((channel) => ({
		name: `email-${channel.id}`,
		app_channel_id: channel.id,
		host: faker.internet.domainName(),
		port: faker.number.int({ min: 1, max: 65535 }),
		alias: faker.internet.userName(),
		is_active: faker.datatype.boolean(),
		auth_email: faker.internet.email(),
		auth_pass: faker.internet.password(),
		created_at: faker.date.past(),
		updated_at: faker.date.recent(),
	}));

	await knex('email_configs').insert(emailConfigs);

	// Seed SMS configs
	const smsChannels = await knex('app_channels')
		.whereIn(
			'id',
			appChannelIds.map((ac) => ac.id),
		)
		.whereIn(
			'channel_type_id',
			channelTypeIds.filter((ct) => ct.name === 'sms').map((ct) => ct.id),
		);
	const smsConfigs = smsChannels.map((channel) => ({
		name: `sms-${channel.id}`,
		app_channel_id: channel.id,
		account_sid: faker.string.alphanumeric(34),
		auth_token: faker.string.alphanumeric(32),
		is_active: faker.datatype.boolean(),
		from_phone_number: faker.phone.number(),
		phone_number: faker.phone.number(),
		created_at: faker.date.past(),
		updated_at: faker.date.recent(),
	}));

	await knex('sms_configs').insert(smsConfigs);

	// Seed Discord configs
	const discordChannels = await knex('app_channels')
		.whereIn(
			'id',
			appChannelIds.map((ac) => ac.id),
		)
		.whereIn(
			'channel_type_id',
			channelTypeIds.filter((ct) => ct.name === 'discord').map((ct) => ct.id),
		);

	const discordConfigs = discordChannels.map((channel) => ({
		name: `discord-${channel.id}`,
		app_channel_id: channel.id,
		is_active: faker.datatype.boolean(),
		webhook_url: faker.internet.url(),
		created_at: faker.date.past(),
		updated_at: faker.date.recent(),
	}));

	await knex('discord_configs').insert(discordConfigs);

	// Seed notifications
	const notifications = Array(50)
		.fill(null)
		.map(() => ({
			id: faker.string.uuid(),
			app_id: faker.helpers.arrayElement(appIds).id,
			message: faker.lorem.sentence(),
			details: JSON.stringify(
				faker.helpers.objectEntry({ key: faker.word.sample(), value: faker.word.sample() }),
			),
			created_at: faker.date.past(),
			updated_at: faker.date.recent(),
		}));

	await knex('notifications').insert(notifications);
}
