import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { UploadsController } from "./uploads.controller";
import { AudioStorageService } from "./audio-storage.service";

@Module({
  imports: [ConfigModule],
  controllers: [UploadsController],
  providers: [AudioStorageService],
  exports: [AudioStorageService],
})
export class UploadsModule {}
