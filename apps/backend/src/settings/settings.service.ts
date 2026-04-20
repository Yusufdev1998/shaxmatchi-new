import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import type { DrizzleDb } from "../db";
import { appSettings } from "../db/schema";
import { DRIZZLE_DB } from "../db/tokens";

@Injectable()
export class SettingsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null) {}

  private getDb(): DrizzleDb {
    if (!this.db) throw new ServiceUnavailableException("Database is not configured");
    return this.db;
  }

  /** Singleton row. Migration seeds it; if missing (e.g. fresh dev DB), insert defaults. */
  async getSettings() {
    const db = this.getDb();
    const rows = await db
      .select()
      .from(appSettings)
      .orderBy(asc(appSettings.updatedAt))
      .limit(1);
    const row = rows[0];
    if (row) return row;
    const inserted = await db.insert(appSettings).values({}).returning();
    return inserted[0]!;
  }

  async updateSettings(input: { audioAutoplay?: boolean; audioDelaySeconds?: number }) {
    const db = this.getDb();
    const current = await this.getSettings();
    const patch: { audioAutoplay?: boolean; audioDelaySeconds?: number; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (input.audioAutoplay !== undefined) patch.audioAutoplay = input.audioAutoplay;
    if (input.audioDelaySeconds !== undefined) patch.audioDelaySeconds = input.audioDelaySeconds;
    const rows = await db
      .update(appSettings)
      .set(patch)
      .where(eq(appSettings.id, current.id))
      .returning();
    return rows[0]!;
  }
}
