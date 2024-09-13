import dotenv from 'dotenv';
import { Knex } from 'knex';
// @ts-expect-error - it's ok
import { faker } from '@faker-js/faker';
import path from 'node:path';

const env = dotenv.config({ path: path.resolve(path.join(process.cwd(), '..', '..', '.env')) });

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
			username: env.parsed?.APP_ADMIN_EMAIL?.split('@')[0],
			email: env.parsed?.APP_ADMIN_EMAIL,
			is_admin: true,
			max_apps_allowed: 999999,
			created_at: new Date(),
			updated_at: new Date(),
		},
		...Array(2)
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
	const apps = Array(6)
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
			max_monthly_alerts_allowed: 100,
			user_monthly_limit_threshold: faker.number.int({ min: 0, max: 50 }),
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

	// Find the email channel type
	const emailChannelType = channelTypeIds.find((channelType) => channelType.name === 'email');

	// Seed app channels (only email)
	const appChannels = appIds.map((app) => ({
		app_id: app.id,
		channel_type_id: emailChannelType.id,
		is_active: true,
		created_at: faker.date.past(),
		updated_at: faker.date.recent(),
	}));

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
		host: 'dt0PYNRnqDMo7eqz6_aiVpSWwLJS1o07B0eCTUIoYnVGiK0',
		port: 'lewPmyKufdyI1p8TZJGkKC2NuoJuid2t6VOotQhlPB0',
		alias: 'cpdeh_1N-UybxDZwI8EVc2Eq33QcZLCMnOBB5PSRIRaRLK4R2HxDKd7gXA',
		auth_email: 'xGdTiOGQ7ClF5S24PJkt-zNA6Q_CiRpRUYZyUeKcPMVkcxNHwS-i-J7JIQ',
		auth_pass: 'UGXJW7pSaCDTw15y_5MIoi5wvlLfc-2G6hhU6tbTeEoq61UW',
		created_at: faker.date.past(),
		updated_at: faker.date.recent(),
	}));

	await knex('email_configs').insert(emailConfigs);

	// Seed SMS configs
	// const smsChannels = await knex('app_channels')
	// 	.whereIn(
	// 		'id',
	// 		appChannelIds.map((ac) => ac.id),
	// 	)
	// 	.whereIn(
	// 		'channel_type_id',
	// 		channelTypeIds.filter((ct) => ct.name === 'sms').map((ct) => ct.id),
	// 	);
	// const smsConfigs = smsChannels.map((channel) => ({
	// 	name: `sms-${channel.id}`,
	// 	app_channel_id: channel.id,
	// 	account_sid: faker.string.alphanumeric(34),
	// 	auth_token: faker.string.alphanumeric(32),
	// 	from_phone_number: faker.phone.number(),
	// 	phone_number: faker.phone.number(),
	// 	created_at: faker.date.past(),
	// 	updated_at: faker.date.recent(),
	// }));

	// await knex('sms_configs').insert(smsConfigs);

	// Seed Discord configs
	// const discordChannels = await knex('app_channels')
	// 	.whereIn(
	// 		'id',
	// 		appChannelIds.map((ac) => ac.id),
	// 	)
	// 	.whereIn(
	// 		'channel_type_id',
	// 		channelTypeIds.filter((ct) => ct.name === 'discord').map((ct) => ct.id),
	// 	);

	// const discordConfigs = discordChannels.map((channel) => ({
	// 	name: `discord-${channel.id}`,
	// 	app_channel_id: channel.id,
	// 	webhook_url: faker.internet.url(),
	// 	created_at: faker.date.past(),
	// 	updated_at: faker.date.recent(),
	// }));

	// await knex('discord_configs').insert(discordConfigs);

	// Seed notifications
	const notifications = Array(50)
		.fill(null)
		.map(() => {
			const createdAt = faker.date.past();
			const updatedAt = faker.date.between({ from: createdAt, to: new Date() });
			const isRead = faker.datatype.boolean();

			return {
				id: faker.string.uuid(),
				app_id: faker.helpers.arrayElement(appIds).id,
				message: faker.lorem.sentence(),
				details: JSON.stringify(
					faker.helpers.objectEntry({ key: faker.word.sample(), value: faker.word.sample() }),
				),
				created_at: createdAt,
				updated_at: updatedAt,
				read_at: isRead ? faker.date.between({ from: updatedAt, to: new Date() }) : null,
			};
		});

	await knex('notifications').insert(notifications);
}
