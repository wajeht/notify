import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("jobs", (table) => {
    table.increments("id").primary();
    table.string("type").notNullable(); // 'discord', 'email', 'sms'
    table.text("payload").notNullable(); // JSON data
    table.string("status").defaultTo("pending"); // pending, processing, completed, failed
    table.integer("attempts").defaultTo(0);
    table.integer("max_attempts").defaultTo(5);
    table.text("error").nullable();
    table.timestamp("run_at").defaultTo(knex.fn.now());
    table.timestamp("completed_at").nullable();
    table.timestamps(true, true);

    table.index(["status", "run_at"]);
    table.index("type");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("jobs");
}
