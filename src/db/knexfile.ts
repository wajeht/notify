import path from "node:path";
import type { Knex } from "knex";
import { CustomMigrationSource } from "./migration-source";

const isTesting = process.env.NODE_ENV === "testing" || process.env.APP_ENV === "testing";
const migrationsPath = path.resolve(__dirname, "migrations");

const knexConfig: Knex.Config = {
  client: "better-sqlite3",
  useNullAsDefault: true,
  connection: path.resolve(__dirname, "sqlite", "db.sqlite"),
  migrations: {
    tableName: "knex_migrations",
    migrationSource: new CustomMigrationSource(migrationsPath),
  },
  seeds: { directory: path.resolve(__dirname, "./seeds") },
  pool: {
    min: 1,
    max: 4,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    afterCreate: (conn: any, done: (err: Error | null, conn: any) => void) => {
      // SQLite pragmas for performance
      conn.pragma("journal_mode = WAL");
      conn.pragma("synchronous = NORMAL");
      conn.pragma("busy_timeout = 120000");
      conn.pragma("cache_size = -64000"); // 64MB
      conn.pragma("temp_store = MEMORY");
      conn.pragma("mmap_size = 268435456"); // 256MB
      conn.pragma("wal_autocheckpoint = 4000");
      conn.pragma("foreign_keys = ON");
      conn.pragma("page_size = 4096");
      done(null, conn);
    },
  },
};

if (isTesting) {
  knexConfig.connection = {
    filename: ":memory:",
  };
  knexConfig.log = {
    warn: () => {},
    error: () => {},
    debug: () => {},
    deprecate: () => {},
  };
}

export default knexConfig;
