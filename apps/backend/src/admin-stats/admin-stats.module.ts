import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module";
import { AdminStatsController } from "./admin-stats.controller";
import { AdminStatsService } from "./admin-stats.service";

@Module({
  imports: [DbModule],
  controllers: [AdminStatsController],
  providers: [AdminStatsService],
})
export class AdminStatsModule {}
