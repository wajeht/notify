import path from "node:path";
import type { Knex } from "knex";

const knexConfig: Knex.Config = {
  client: "better-sqlite3",
  connection: {
    filename: path.resolve(__dirname, "sqlite", "db.sqlite"),
  },
  useNullAsDefault: true,
  migrations: {
    extension: "ts",
    tableName: "knex_migrations",
    directory: path.resolve(__dirname, "./migrations"),
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
      conn.pragma("cache_size = -500000"); // 500MB
      conn.pragma("temp_store = MEMORY");
      conn.pragma("mmap_size = 1073741824"); // 1GB
      conn.pragma("wal_autocheckpoint = 4000");
      conn.pragma("foreign_keys = ON");
      conn.pragma("page_size = 4096");
      done(null, conn);
    },
  },
};

const isTesting = process.env.NODE_ENV === "testing" || process.env.APP_ENV === "testing";

if (isTesting) {
  knexConfig.connection = {
    filename: ":memory:",
  };
}

export default knexConfig;
