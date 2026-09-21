import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createReadStream, existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import type { Readable } from "node:stream";

/**
 * Where audio lives on the container filesystem. Historically the only home for
 * recordings; now a read-through fallback for files uploaded before the move to
 * object storage, and the sole store when no bucket is configured (local dev).
 */
export const AUDIO_DIR = process.env.AUDIO_DIR
  ? resolve(process.env.AUDIO_DIR)
  : resolve("/mnt", "audio");

/** Explicit audio types; the extension-based default maps .webm to `video/webm`. */
export const AUDIO_CONTENT_TYPES: Record<string, string> = {
  ".webm": "audio/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
};

export function audioContentType(filename: string): string {
  return AUDIO_CONTENT_TYPES[extname(filename).toLowerCase()] ?? "application/octet-stream";
}

export type AudioObject = {
  body: Readable;
  contentType: string;
  contentLength?: number;
  /** Set when the request carried a Range the store could satisfy. */
  contentRange?: string;
  /** True when served from the legacy volume rather than the bucket. */
  fromDisk: boolean;
};

/**
 * Audio file storage, backed by an S3-compatible bucket with the old volume as a
 * read-through fallback.
 *
 * The fallback is what makes the migration safe: a file is served whether or not it
 * has been copied to the bucket yet, so uploads, playback and the copy script can run
 * in any order without a window where audio is unavailable.
 *
 * With no bucket configured the service degrades to disk-only, matching how the rest
 * of the app treats optional infrastructure (DB, Web Push, Telegram).
 */
@Injectable()
export class AudioStorageService {
  private readonly logger = new Logger(AudioStorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>("AWS_ENDPOINT_URL");
    const bucket = this.config.get<string>("AWS_S3_BUCKET_NAME");
    const accessKeyId = this.config.get<string>("AWS_ACCESS_KEY_ID");
    const secretAccessKey = this.config.get<string>("AWS_SECRET_ACCESS_KEY");
    const region = this.config.get<string>("AWS_DEFAULT_REGION") ?? "us-east-1";
    this.bucket = bucket ?? "";

    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      this.client = null;
      this.logger.warn(
        "Audio bucket is not configured; falling back to disk only. " +
          "Set AWS_ENDPOINT_URL / AWS_S3_BUCKET_NAME / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY.",
      );
    } else {
      this.client = new S3Client({
        endpoint,
        region,
        credentials: { accessKeyId, secretAccessKey },
        // Bucket-as-subdomain does not work against a custom endpoint host.
        forcePathStyle: true,
      });
      this.logger.log(`Audio bucket configured: ${bucket} @ ${endpoint}`);
    }

    try {
      if (!existsSync(AUDIO_DIR)) mkdirSync(AUDIO_DIR, { recursive: true });
    } catch {
      // On Railway the volume already exists; locally /mnt may not be writable. Disk
      // reads simply miss, and the bucket serves everything.
    }
  }

  get bucketConfigured(): boolean {
    return this.client !== null;
  }

  /** Store a freshly uploaded file. Throws if it cannot be persisted anywhere. */
  async put(filename: string, body: Buffer): Promise<void> {
    if (this.client) {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: filename,
          Body: body,
          ContentType: audioContentType(filename),
        }),
      );
      return;
    }
    // No bucket (local dev): keep the original on-disk behaviour.
    await writeFile(resolve(AUDIO_DIR, filename), body);
  }

  /**
   * Read a file, preferring the bucket and falling back to the volume.
   * `range` is forwarded so players can seek — without it, scrubbing a long
   * explanation would download the whole file first.
   */
  async get(filename: string, range?: string): Promise<AudioObject> {
    if (this.client) {
      try {
        const res = await this.client.send(
          new GetObjectCommand({ Bucket: this.bucket, Key: filename, Range: range }),
        );
        if (res.Body) {
          return {
            body: res.Body as Readable,
            contentType: res.ContentType || audioContentType(filename),
            contentLength: res.ContentLength,
            contentRange: res.ContentRange,
            fromDisk: false,
          };
        }
      } catch (err) {
        // Not in the bucket (yet) — fall through to the volume. Anything else is worth
        // knowing about, but the fallback still gives the listener a chance.
        const name = (err as { name?: string })?.name;
        if (name !== "NoSuchKey" && name !== "NotFound") {
          this.logger.warn(`Bucket read failed for ${filename}: ${String(err)}`);
        }
      }
    }
    return this.getFromDisk(filename, range);
  }

  private getFromDisk(filename: string, range?: string): AudioObject {
    const filePath = resolve(AUDIO_DIR, filename);
    if (!existsSync(filePath)) throw new NotFoundException("Audio file not found");
    const size = statSync(filePath).size;
    const contentType = audioContentType(filename);

    const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
    if (match) {
      const startRaw = match[1];
      const endRaw = match[2];
      let start = startRaw ? Number(startRaw) : 0;
      let end = endRaw ? Number(endRaw) : size - 1;
      if (!startRaw && endRaw) {
        // "bytes=-N" means the final N bytes.
        start = Math.max(0, size - Number(endRaw));
        end = size - 1;
      }
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < size) {
        end = Math.min(end, size - 1);
        return {
          body: createReadStream(filePath, { start, end }),
          contentType,
          contentLength: end - start + 1,
          contentRange: `bytes ${start}-${end}/${size}`,
          fromDisk: true,
        };
      }
    }
    return {
      body: createReadStream(filePath),
      contentType,
      contentLength: size,
      fromDisk: true,
    };
  }

  /** Remove a file from both stores. Missing in either place is not an error. */
  async remove(filename: string): Promise<void> {
    if (this.client) {
      try {
        await this.client.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: filename }),
        );
      } catch (err) {
        this.logger.warn(`Bucket delete failed for ${filename}: ${String(err)}`);
      }
    }
    try {
      const filePath = resolve(AUDIO_DIR, filename);
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
      /* an orphan on disk is harmless; nothing references it */
    }
  }
}
