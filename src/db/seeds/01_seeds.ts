import type { Knex } from "knex";
import { randomUUID } from "node:crypto";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const adminEmail = process.env.APP_ADMIN_EMAIL || "admin@example.com";

export async function seed(knex: Knex): Promise<void> {
  await knex("notifications").del();
  await knex("discord_configs").del();
  await knex("sms_configs").del();
  await knex("email_configs").del();
  await knex("app_channels").del();
  await knex("apps").del();
  await knex("channel_types").del();
  await knex("users").del();

  // Seed users
  const users = [
    {
      username: adminEmail.split("@")[0],
      email: adminEmail,
      is_admin: true,
      max_apps_allowed: 999999,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      username: "john_doe",
      email: "john.doe@example.com",
      is_admin: false,
      max_apps_allowed: 3,
      created_at: new Date("2024-01-15"),
      updated_at: new Date("2024-02-01"),
    },
    {
      username: "jane_smith",
      email: "jane.smith@example.com",
      is_admin: false,
      max_apps_allowed: 5,
      created_at: new Date("2024-01-20"),
      updated_at: new Date("2024-02-10"),
    },
  ];
  const userIds = await knex("users").insert(users).returning("id");

  // Seed apps
  const apps = [
    {
      user_id: userIds[0].id,
      name: "E-commerce Platform",
      url: "https://shop.example.com",
      description: "Online shopping platform for electronics",
      is_active: true,
      api_key: "app-key-001",
      api_key_version: 1,
      api_key_created_at: new Date("2024-01-15"),
      created_at: new Date("2024-01-15"),
      updated_at: new Date("2024-02-01"),
    },
    {
      user_id: userIds[1].id,
      name: "Task Manager",
      url: "https://tasks.example.com",
      description: "Project management and task tracking",
      is_active: true,
      api_key: "app-key-002",
      api_key_version: 2,
      api_key_created_at: new Date("2024-01-20"),
      created_at: new Date("2024-01-20"),
      updated_at: new Date("2024-02-05"),
    },
    {
      user_id: userIds[2].id,
      name: "Analytics Dashboard",
      url: "https://analytics.example.com",
      description: "Business intelligence and reporting",
      is_active: false,
      api_key: "app-key-003",
      api_key_version: 1,
      api_key_created_at: new Date("2024-01-25"),
      created_at: new Date("2024-01-25"),
      updated_at: new Date("2024-01-30"),
    },
    {
      user_id: userIds[0].id,
      name: "Customer Support",
      url: "https://support.example.com",
      description: "Help desk and ticketing system",
      is_active: true,
      api_key: "app-key-004",
      api_key_version: 3,
      api_key_created_at: new Date("2024-02-01"),
      created_at: new Date("2024-02-01"),
      updated_at: new Date("2024-02-10"),
    },
    {
      user_id: userIds[1].id,
      name: "Inventory System",
      url: "https://inventory.example.com",
      description: "Stock management and tracking",
      is_active: true,
      api_key: "app-key-005",
      api_key_version: 1,
      api_key_created_at: new Date("2024-02-05"),
      created_at: new Date("2024-02-05"),
      updated_at: new Date("2024-02-12"),
    },
    {
      user_id: userIds[2].id,
      name: "Payment Gateway",
      url: "https://payments.example.com",
      description: "Secure payment processing",
      is_active: true,
      api_key: "app-key-006",
      api_key_version: 2,
      api_key_created_at: new Date("2024-02-10"),
      created_at: new Date("2024-02-10"),
      updated_at: new Date("2024-02-15"),
    },
  ];

  const appIds = await knex("apps").insert(apps).returning("id");

  // Seed channel types
  const channelTypes = ["email", "sms", "discord"].map((name) => ({
    name,
    created_at: new Date("2024-01-15"),
    updated_at: new Date("2024-02-01"),
  }));

  const channelTypeIds = await knex("channel_types").insert(channelTypes).returning("*");

  // Find the email channel type
  const emailChannelType = channelTypeIds.find((channelType) => channelType.name === "email");

  // Seed app channels (only email)
  const appChannels = appIds.map((app) => ({
    app_id: app.id,
    channel_type_id: emailChannelType.id,
    is_active: true,
    created_at: new Date("2024-01-15"),
    updated_at: new Date("2024-02-01"),
  }));

  const appChannelIds = await knex("app_channels").insert(appChannels).returning("id");

  // Seed email configs
  const emailChannels = await knex("app_channels")
    .whereIn(
      "id",
      appChannelIds.map((ac) => ac.id),
    )
    .whereIn(
      "channel_type_id",
      channelTypeIds.filter((ct) => ct.name === "email").map((ct) => ct.id),
    );

  const emailConfigs = emailChannels.map((channel) => ({
    name: `email-${channel.id}`,
    app_channel_id: channel.id,
    host: "dt0PYNRnqDMo7eqz6_aiVpSWwLJS1o07B0eCTUIoYnVGiK0",
    port: "lewPmyKufdyI1p8TZJGkKC2NuoJuid2t6VOotQhlPB0",
    alias: "cpdeh_1N-UybxDZwI8EVc2Eq33QcZLCMnOBB5PSRIRaRLK4R2HxDKd7gXA",
    auth_email: "xGdTiOGQ7ClF5S24PJkt-zNA6Q_CiRpRUYZyUeKcPMVkcxNHwS-i-J7JIQ",
    auth_pass: "UGXJW7pSaCDTw15y_5MIoi5wvlLfc-2G6hhU6tbTeEoq61UW",
    created_at: new Date("2024-01-15"),
    updated_at: new Date("2024-02-01"),
  }));

  await knex("email_configs").insert(emailConfigs);

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
  // 	account_sid: 'AC1234567890abcdef1234567890abcdef',
  // 	auth_token: 'abcdef1234567890abcdef1234567890',
  // 	from_phone_number: '+1234567890',
  // 	phone_number: '+0987654321',
  // 	created_at: new Date('2024-01-15'),
  // 	updated_at: new Date('2024-02-01'),
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
  // 	webhook_url: 'https://discord.com/api/webhooks/1234567890/abcdef',
  // 	created_at: new Date('2024-01-15'),
  // 	updated_at: new Date('2024-02-01'),
  // }));

  // await knex('discord_configs').insert(discordConfigs);

  // Seed notifications
  const notifications = [
    {
      id: randomUUID(),
      app_id: appIds[0].id,
      message: "New order received",
      details: JSON.stringify({ order_id: "ORD-001", amount: 99.99 }),
      created_at: new Date("2024-02-01T10:00:00Z"),
      updated_at: new Date("2024-02-01T10:00:00Z"),
      read_at: new Date("2024-02-01T10:30:00Z"),
    },
    {
      id: randomUUID(),
      app_id: appIds[1].id,
      message: "Task completed",
      details: JSON.stringify({ task_id: "TSK-001", user: "john_doe" }),
      created_at: new Date("2024-02-01T11:00:00Z"),
      updated_at: new Date("2024-02-01T11:00:00Z"),
      read_at: null,
    },
    {
      id: randomUUID(),
      app_id: appIds[2].id,
      message: "Report generated",
      details: JSON.stringify({ report_type: "monthly", status: "success" }),
      created_at: new Date("2024-02-01T12:00:00Z"),
      updated_at: new Date("2024-02-01T12:00:00Z"),
      read_at: new Date("2024-02-01T12:15:00Z"),
    },
    {
      id: randomUUID(),
      app_id: appIds[3].id,
      message: "Support ticket created",
      details: JSON.stringify({ ticket_id: "TKT-001", priority: "high" }),
      created_at: new Date("2024-02-01T13:00:00Z"),
      updated_at: new Date("2024-02-01T13:00:00Z"),
      read_at: null,
    },
    {
      id: randomUUID(),
      app_id: appIds[4].id,
      message: "Low stock alert",
      details: JSON.stringify({ product: "Widget A", quantity: 5 }),
      created_at: new Date("2024-02-01T14:00:00Z"),
      updated_at: new Date("2024-02-01T14:00:00Z"),
      read_at: null,
    },
    {
      id: randomUUID(),
      app_id: appIds[5].id,
      message: "Payment processed",
      details: JSON.stringify({ payment_id: "PAY-001", amount: 249.99 }),
      created_at: new Date("2024-02-01T15:00:00Z"),
      updated_at: new Date("2024-02-01T15:00:00Z"),
      read_at: new Date("2024-02-01T15:10:00Z"),
    },
    {
      id: randomUUID(),
      app_id: appIds[0].id,
      message: "Order shipped",
      details: JSON.stringify({ order_id: "ORD-002", tracking: "TRK123456" }),
      created_at: new Date("2024-02-02T09:00:00Z"),
      updated_at: new Date("2024-02-02T09:00:00Z"),
      read_at: null,
    },
    {
      id: randomUUID(),
      app_id: appIds[1].id,
      message: "Project milestone reached",
      details: JSON.stringify({ project: "Website Redesign", milestone: "50%" }),
      created_at: new Date("2024-02-02T10:00:00Z"),
      updated_at: new Date("2024-02-02T10:00:00Z"),
      read_at: new Date("2024-02-02T10:30:00Z"),
    },
    {
      id: randomUUID(),
      app_id: appIds[3].id,
      message: "Ticket resolved",
      details: JSON.stringify({ ticket_id: "TKT-002", resolution_time: "2 hours" }),
      created_at: new Date("2024-02-02T11:00:00Z"),
      updated_at: new Date("2024-02-02T11:00:00Z"),
      read_at: null,
    },
    {
      id: randomUUID(),
      app_id: appIds[4].id,
      message: "Inventory updated",
      details: JSON.stringify({ product: "Widget B", new_quantity: 100 }),
      created_at: new Date("2024-02-02T12:00:00Z"),
      updated_at: new Date("2024-02-02T12:00:00Z"),
      read_at: new Date("2024-02-02T12:05:00Z"),
    },
  ];

  await knex("notifications").insert(notifications);
}
