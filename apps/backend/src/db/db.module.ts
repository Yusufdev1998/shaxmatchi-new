import { Inject, Module, OnApplicationShutdown, Optional } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import type { Sql } from "postgres";

import { createDrizzleDb, createPostgresClient } from "./db";
import { DRIZZLE_CLIENT, DRIZZLE_DB } from "./tokens";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DRIZZLE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Sql | null => {
        const databaseUrl = config.get<string>("DATABASE_URL");
        if (!databaseUrl) {
          // Keep boot non-fatal; consumers can decide how to handle "no DB configured".
          console.warn("[db] DATABASE_URL is not set; Drizzle DB provider will be null.");
          return null;
        }
        return createPostgresClient(databaseUrl);
      }
    },
    {
      provide: DRIZZLE_DB,
      inject: [DRIZZLE_CLIENT],
      useFactory: (client: Sql | null) => {
        if (!client) return null;
        return createDrizzleDb(client);
      }
    }
  ],
  exports: [DRIZZLE_DB]
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Optional() @Inject(DRIZZLE_CLIENT) private readonly client: Sql | null) {}

  async onApplicationShutdown() {
    if (!this.client) return;
    await this.client.end({ timeout: 5 });
  }
}

