import { HttpException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Bot, InputFile } from "grammy";
import { EdgeTTS } from "edge-tts-universal";
import { UsersService } from "../users/users.service";

/** Microsoft Edge TTS voice id for Uzbek (female, warm tone — works well for kids). */
const DEFAULT_UZBEK_VOICE = "uz-UZ-MadinaNeural";

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
          "Shaxmatchi botiga xush kelibsiz. O'qituvchi yuborgan bog'lash havolasini oching, keyin Shaxmatchini oching.",
        );
        return;
      }
      try {
        await this.usersService.linkTelegramAccountFromToken(payload, String(ctx.from?.id ?? ""));
        await ctx.reply("✅ Telegram akkauntingiz o'quvchi profiliga bog'landi. Endi Shaxmatchini oching.");
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

  /** Sends a Telegram message to a linked chat. Logs and swallows errors (chat blocked, invalid id, bot disabled). */
  async sendMessage(
    telegramId: string,
    text: string,
    options?: { parseMode?: "HTML" | "Markdown" | "MarkdownV2" },
  ): Promise<boolean> {
    const bot = this.bot;
    if (!bot) return false;
    if (!telegramId) return false;
    try {
      await bot.api.sendMessage(telegramId, text, {
        parse_mode: options?.parseMode,
      });
      return true;
    } catch (err) {
      this.logger.warn(`sendMessage(${telegramId}) failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /**
   * Synthesizes Uzbek TTS via Edge and sends it as a Telegram audio file —
   * intended for young students who can't read the typed notification.
   */
  async sendSpokenMessage(
    telegramId: string,
    spokenText: string,
    options?: { voice?: string; title?: string; performer?: string; caption?: string },
  ): Promise<boolean> {
    const bot = this.bot;
    if (!bot) return false;
    if (!telegramId || !spokenText.trim()) return false;
    try {
      const voice = options?.voice ?? DEFAULT_UZBEK_VOICE;
      const tts = new EdgeTTS(spokenText, voice, { rate: "-20%" });
      const result = await tts.synthesize();
      const audioBuffer = Buffer.from(await result.audio.arrayBuffer());
      await bot.api.sendAudio(
        telegramId,
        new InputFile(audioBuffer, "notification.mp3"),
        {
          title: options?.title ?? "Shaxmatchi",
          performer: options?.performer ?? "O'qituvchi",
          caption: options?.caption,
        },
      );
      return true;
    } catch (err) {
      this.logger.warn(
        `sendSpokenMessage(${telegramId}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }
}
