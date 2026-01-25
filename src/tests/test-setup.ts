process.env.APP_ENV = "testing";
process.env.NODE_ENV = "testing";

import { afterAll, beforeAll } from "vitest";
import { db } from "../db/db";

beforeAll(async () => {
  await db.migrate.latest();
  await db.seed.run();
});

afterAll(async () => {
  await db.destroy();
});
