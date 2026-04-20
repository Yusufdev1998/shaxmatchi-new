import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { AdminStatsModule } from "./admin-stats/admin-stats.module";
import { DebutsModule } from "./debuts/debuts.module";
import { DbModule } from "./db/db.module";
import { SettingsModule } from "./settings/settings.module";
import { StudentModule } from "./student/student.module";
import { TelegramModule } from "./telegram/telegram.module";
import { UploadsModule } from "./uploads/uploads.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DbModule,
    AuthModule,
    AdminStatsModule,
    DebutsModule,
    SettingsModule,
    StudentModule,
    TelegramModule,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}

