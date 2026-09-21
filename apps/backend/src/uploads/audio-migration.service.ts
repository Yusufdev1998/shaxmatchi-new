import { Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import type { DrizzleDb } from "../db";
import { appMeta } from "../db/schema";
import { DRIZZLE_DB } from "../db/tokens";
import { AUDIO_CONTENT_TYPES, AUDIO_DIR, AudioStorageService } from "./audio-storage.service";

/** appMeta key recording that the volume has been copied into the bucket. */
const MIGRATED_KEY = "audio_volume_migrated";

/**
 * Copies pre-existing explanation audio from the container volume into the bucket,
 * once, on the first boot after the bucket is configured.
 *
 * This exists because the volume is only reachable from inside the deployed container
 * — there is no way to run the copy from a developer machine without handing the
 * bucket credentials around. Doing it on boot keeps the credentials where they belong.
 *
 * Safety properties:
 *  - additive only; nothing is ever deleted from the volume
 *  - idempotent per file (skips anything already in the bucket at the same size)
 *  - runs in the background, so a slow copy never delays the app accepting traffic
 *  - the "done" marker is only written after a clean run, so a partial or failed
 *    copy is retried on the next boot
 *  - a missing/unreadable volume is not an error: there is simply nothing to copy
 */
@Injectable()
export class AudioMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AudioMigrationService.name);

  constructor(
    private readonly storage: AudioStorageService,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null,
  ) {}

  onApplicationBootstrap(): void {
    // Deliberately not awaited — boot must not wait on a few hundred file copies.
    void this.runOnce().catch((err) => {
      this.logger.error(`Audio migration failed: ${String(err)}`);
    });
  }

  private async runOnce(): Promise<void> {
    if (!this.storage.bucketConfigured) return;
    if (!this.db) return;

    const [marker] = await this.db
      .select({ value: appMeta.value })
      .from(appMeta)
      .where(eq(appMeta.key, MIGRATED_KEY))
      .limit(1);
    if (marker) return;

    let files: string[];
    try {
      files = (await readdir(AUDIO_DIR)).filter(
        (f) => extname(f).toLowerCase() in AUDIO_CONTENT_TYPES,
      );
    } catch {
      // No volume mounted here (or empty) — nothing to migrate, and nothing to record:
      // a later deploy that *does* have the volume should still get its chance.
      this.logger.log(`No audio volume at ${AUDIO_DIR}; skipping migration.`);
      return;
    }
    if (files.length === 0) {
      this.logger.log(`Audio volume at ${AUDIO_DIR} is empty; nothing to migrate.`);
      return;
    }

    this.logger.log(`Migrating ${files.length} audio file(s) from ${AUDIO_DIR} to the bucket…`);
    let copied = 0;
    let skipped = 0;
    let failed = 0;

    for (const name of files) {
      try {
        const path = resolve(AUDIO_DIR, name);
        const size = (await stat(path)).size;
        if (await this.storage.existsInBucket(name, size)) {
          skipped++;
          continue;
        }
        await this.storage.putToBucket(name, await readFile(path));
        copied++;
        if (copied % 50 === 0) this.logger.log(`  … ${copied} copied`);
      } catch (err) {
        failed++;
        this.logger.warn(`  failed to copy ${name}: ${String(err)}`);
      }
    }

    this.logger.log(
      `Audio migration: copied ${copied}, already present ${skipped}, failed ${failed}. ` +
        `The volume was not modified.`,
    );

    if (failed > 0) {
      this.logger.warn("Leaving the migration unmarked so the next boot retries the failures.");
      return;
    }
    await this.db
      .insert(appMeta)
      .values({ key: MIGRATED_KEY, value: `${copied + skipped} files` })
      .onConflictDoNothing();
  }
}
