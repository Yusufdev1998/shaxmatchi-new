import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DbModule } from "../db/db.module";
import { UploadsController } from "./uploads.controller";
import { AudioStorageService } from "./audio-storage.service";
import { AudioMigrationService } from "./audio-migration.service";
import { AudioBucketHealthService } from "./audio-bucket-health.service";

@Module({
  imports: [ConfigModule, DbModule],
  controllers: [UploadsController],
  providers: [AudioStorageService, AudioMigrationService, AudioBucketHealthService],
  exports: [AudioStorageService],
})
export class UploadsModule {}
