import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { AudioStorageService } from "./audio-storage.service";

/**
 * Checks that the audio bucket still accepts our credentials, on boot and hourly.
 *
 * Why hourly and not just on boot: Railway resolves `${{bucket.*}}` variable
 * references only when a deployment starts. When it rotated every bucket's keys after
 * its October 2026 security incident, the running backend kept the old ones and every
 * explanation silently 404'd — playback falls back to the volume, which no longer
 * holds the files. Nothing was logged at error level, so it surfaced only when a
 * student noticed. The boot check catches bad config on deploy; the hourly one
 * catches keys that change underneath a running process.
 *
 * Logs an error on every failed check (hourly is low noise, and keeps it visible
 * in recent logs), and a single line on recovery.
 */
@Injectable()
export class AudioBucketHealthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AudioBucketHealthService.name);
  private failing = false;

  constructor(private readonly storage: AudioStorageService) {}

  onApplicationBootstrap(): void {
    // Not awaited — boot must not wait on a network round-trip to the bucket.
    void this.check();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async check(): Promise<void> {
    const problem = await this.storage.probeBucket();
    if (problem) {
      this.failing = true;
      this.logger.error(
        `Audio bucket is unreachable — explanation audio will not play. ${problem.replace(/\.$/, "")}. ` +
          "If this is SignatureDoesNotMatch or InvalidAccessKeyId, the bucket's keys " +
          "changed: redeploy the backend so Railway re-resolves the AWS_* references.",
      );
    } else if (this.failing) {
      this.failing = false;
      this.logger.log("Audio bucket is reachable again.");
    }
  }
}
