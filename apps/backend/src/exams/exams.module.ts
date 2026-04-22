import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module";
import { TelegramModule } from "../telegram/telegram.module";
import { ExamsController } from "./exams.controller";
import { ExamsService } from "./exams.service";

@Module({
  imports: [DbModule, TelegramModule],
  controllers: [ExamsController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}
