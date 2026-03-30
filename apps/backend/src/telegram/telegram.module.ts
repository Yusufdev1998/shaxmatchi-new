import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { UsersModule } from "../users/users.module";
import { TelegramBotService } from "./telegram-bot.service";

@Module({
  imports: [ConfigModule, UsersModule],
  providers: [TelegramBotService],
})
export class TelegramModule {}
