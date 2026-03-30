import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { DebutsModule } from "./debuts/debuts.module";
import { DbModule } from "./db/db.module";
import { StudentModule } from "./student/student.module";
import { TelegramModule } from "./telegram/telegram.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    AuthModule,
    DebutsModule,
    StudentModule,
    TelegramModule,
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}

