import { HttpException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Bot } from "grammy";
import { UsersService } from "../users/users.service";

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  onModuleInit() {
    const token = this.config.get<string>("TELEGRAM_BOT_TOKEN")?.trim();
    if (!token) {
      this.logger.warn("TELEGRAM_BOT_TOKEN not set; Telegram bot long-polling is disabled");
      return;
    }

    const bot = new Bot(token);
    this.bot = bot;

    bot.command("start", async (ctx) => {
      const text = ctx.message?.text?.trim() ?? "";
      const parts = text.split(/\s+/);
      const payload = parts.length > 1 ? parts[1] : "";
      if (!payload) {
        await ctx.reply(
          "Shaxmatchi botiga xush kelibsiz. O'qituvchi yuborgan bog'lash havolasini oching, keyin Mini Appni ishlating.",
        );
        return;
      }
      try {
        await this.usersService.linkTelegramAccountFromToken(payload, String(ctx.from?.id ?? ""));
        await ctx.reply("✅ Telegram akkauntingiz o'quvchi profiliga bog'landi. Endi Mini Appni oching.");
      } catch (e: unknown) {
        const msg = e instanceof HttpException ? e.message : "Havola yaroqsiz yoki muddati tugagan.";
        await ctx.reply(`❌ ${msg}`);
      }
    });

    bot.catch((err) => {
      this.logger.error(err);
    });

    void bot.start().catch((err) => {
      this.logger.error(err);
    });
  }

  async onModuleDestroy() {
    if (this.bot) {
      await this.bot.stop();
      this.bot = null;
    }
  }
}
