import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module";
import { TelegramModule } from "../telegram/telegram.module";
import { PuzzleCycleService } from "./puzzle-cycle.service";

@Module({
  imports: [DbModule, TelegramModule],
  providers: [PuzzleCycleService],
  exports: [PuzzleCycleService],
})
export class PuzzleCycleModule {}
