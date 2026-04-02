import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { TeacherOnlyGuard } from "../auth/teacher-only.guard";

const AUDIO_DIR = process.env.AUDIO_DIR
  ? resolve(process.env.AUDIO_DIR)
  : resolve("/mnt", "audio");

try {
  if (!existsSync(AUDIO_DIR)) mkdirSync(AUDIO_DIR, { recursive: true });
} catch { /* Railway volume will already exist */ }

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
  @Post("admin/uploads/audio")
  @UseGuards(JwtAuthGuard, TeacherOnlyGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: AUDIO_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase() || ".mp3";
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
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
  uploadAudio(@UploadedFile() file: Express.Multer.File) {
    return { filename: file.filename };
  }

  @Delete("admin/uploads/audio/:filename")
  @UseGuards(JwtAuthGuard, TeacherOnlyGuard)
  deleteAudio(@Param("filename") filename: string) {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "");
    const filePath = resolve(AUDIO_DIR, safe);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    return { ok: true };
  }

  @Get("uploads/audio/:filename")
  serveAudio(@Param("filename") filename: string, @Res() res: Response) {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "");
    const filePath = resolve(AUDIO_DIR, safe);
    if (!existsSync(filePath)) {
      res.status(404).json({ message: "Audio file not found" });
      return;
    }
    res.sendFile(filePath);
  }
}
