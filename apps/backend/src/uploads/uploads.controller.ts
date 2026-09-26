import {
  Controller,
  Delete,
  Get,
  Headers,
  Inject,
  Logger,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import type { Response } from "express";
import { sql } from "drizzle-orm";
import type { DrizzleDb } from "../db";
import { puzzles } from "../db/schema";
import { DRIZZLE_DB } from "../db/tokens";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TeacherOnlyGuard } from "../auth/teacher-only.guard";
import { AudioStorageService } from "./audio-storage.service";

const ALLOWED_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

@Controller()
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(
    private readonly storage: AudioStorageService,
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null,
  ) {}

  @Post("admin/uploads/audio")
  @UseGuards(JwtAuthGuard, TeacherOnlyGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      // Buffered rather than written straight to disk: the file's home is the bucket.
      // Recordings top out around 4 MB, well under the cap below.
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME.has(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`Unsupported audio format: ${file.mimetype}`), false);
        }
      },
    }),
  )
  async uploadAudio(@UploadedFile() file: Express.Multer.File) {
    const ext = extname(file.originalname).toLowerCase() || ".mp3";
    const filename = `${randomUUID()}${ext}`;
    // Awaited: the caller only learns the filename once the bytes are safely stored,
    // so a move can never end up referencing a file that was never written.
    await this.storage.put(filename, file.buffer);
    return { filename };
  }

  @Delete("admin/uploads/audio/:filename")
  @UseGuards(JwtAuthGuard, TeacherOnlyGuard)
  async deleteAudio(@Param("filename") filename: string) {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "");
    // Copying an explanation shares the audio filename rather than duplicating the
    // file, so one file can back several moves. Deleting it because one move let go
    // of it silently broke every other move still pointing at it. Only remove bytes
    // nothing references; when that can't be checked, keep them — an orphan file is
    // harmless, a missing one is lost audio.
    if (await this.isAudioReferenced(safe)) {
      this.logger.log(`Kept ${safe}: still referenced by another move`);
      return { ok: true, kept: true };
    }
    await this.storage.remove(safe);
    return { ok: true };
  }

  @Get("uploads/audio/:filename")
  async serveAudio(
    @Param("filename") filename: string,
    @Headers("range") range: string | undefined,
    @Res() res: Response,
  ) {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "");
    let object;
    try {
      object = await this.storage.get(safe, range);
    } catch {
      res.status(404).json({ message: "Audio file not found" });
      return;
    }

    res.setHeader("Content-Type", object.contentType);
    // Range support is what lets a player scrub a long explanation instead of
    // downloading it whole before it can seek.
    res.setHeader("Accept-Ranges", "bytes");
    if (object.contentLength !== undefined) {
      res.setHeader("Content-Length", String(object.contentLength));
    }
    if (object.contentRange) {
      res.setHeader("Content-Range", object.contentRange);
      res.status(206);
    }

    object.body.on("error", () => {
      if (!res.headersSent) res.status(404).json({ message: "Audio file not found" });
      else res.destroy();
    });
    object.body.pipe(res);
  }

  private async isAudioReferenced(filename: string): Promise<boolean> {
    if (!this.db) return true;
    const probe = JSON.stringify([{ audioUrl: filename }]);
    const rows = await this.db
      .select({ id: puzzles.id })
      .from(puzzles)
      .where(sql`${puzzles.moves} @> ${probe}::jsonb`)
      .limit(1);
    return rows.length > 0;
  }
}
