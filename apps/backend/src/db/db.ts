import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres = require("postgres");

import * as schema from "./schema";

export type DrizzleDb = PostgresJsDatabase<typeof schema>;

export function createPostgresClient(databaseUrl: string) {
  return postgres(databaseUrl, {
    max: 10
  });
}

export function createDrizzleDb(client: ReturnType<typeof createPostgresClient>): DrizzleDb {
  return drizzle(client, { schema });
}

