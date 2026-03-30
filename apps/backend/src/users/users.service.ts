import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { DrizzleDb, NewUser, User } from "../db";
import { telegramLinkTokens, users } from "../db";
import { DRIZZLE_DB } from "../db/tokens";

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null,
    private readonly config: ConfigService,
  ) {}

  private getDb(): DrizzleDb {
    if (!this.db) throw new ServiceUnavailableException("Database is not configured");
    return this.db;
  }

  async findByLogin(login: string): Promise<User | null> {
    const db = this.getDb();
    const rows = await db.select().from(users).where(eq(users.login, login)).limit(1);
    return rows[0] ?? null;
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    const db = this.getDb();
    const rows = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const db = this.getDb();
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async setPasswordForUser(userId: string, passwordHash: string): Promise<void> {
    const db = this.getDb();
    await db.update(users).set({ password: passwordHash }).where(eq(users.id, userId));
  }

  async countTeachers(): Promise<number> {
    const db = this.getDb();
    // simplest portable way without count() helpers: just select ids
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.type, "teacher"));
    return rows.length;
  }

  async createUser(input: NewUser): Promise<User> {
    const db = this.getDb();

    const existing = await this.findByLogin(input.login);
    if (existing) throw new ConflictException("Login is already taken");
    if (input.telegramId) {
      const existingByTelegram = await this.findByTelegramId(input.telegramId);
      if (existingByTelegram) throw new ConflictException("Telegram ID is already linked to another student");
    }

    const rows = await db.insert(users).values(input).returning();
    return rows[0]!;
  }

  async listStudents(): Promise<User[]> {
    const db = this.getDb();
    return await db
      .select()
      .from(users)
      .where(eq(users.type, "student"))
      .orderBy(desc(users.createdAt));
  }

  async getStudentById(studentId: string): Promise<User> {
    const db = this.getDb();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);
    const user = rows[0];
    if (!user || user.type !== "student") throw new NotFoundException("Student not found");
    return user;
  }

  async updateStudent(input: {
    studentId: string;
    login?: string;
    password?: string;
    telegramId?: string | null;
  }): Promise<User> {
    const db = this.getDb();
    const current = await this.getStudentById(input.studentId);

    if (input.login && input.login !== current.login) {
      const existing = await this.findByLogin(input.login);
      if (existing && existing.id !== current.id) throw new ConflictException("Login is already taken");
    }
    if (input.telegramId !== undefined) {
      const normalizedTelegramId = input.telegramId?.trim() || null;
      if (normalizedTelegramId) {
        const existingByTelegram = await this.findByTelegramId(normalizedTelegramId);
        if (existingByTelegram && existingByTelegram.id !== current.id) {
          throw new ConflictException("Telegram ID is already linked to another student");
        }
      }
    }

    const rows = await db
      .update(users)
      .set({
        ...(input.login ? { login: input.login } : {}),
        ...(input.password ? { password: input.password } : {}),
        ...(input.telegramId !== undefined ? { telegramId: input.telegramId?.trim() || null } : {}),
      })
      .where(eq(users.id, current.id))
      .returning();
    return rows[0]!;
  }

  async deleteStudent(studentId: string): Promise<void> {
    const db = this.getDb();
    await this.getStudentById(studentId);
    await db.delete(users).where(eq(users.id, studentId));
  }

  /** Teacher generates `https://t.me/<bot>?start=<token>`; student opens it in Telegram and the bot links their account. */
  async createStudentTelegramDeepLink(studentId: string): Promise<{ deepLink: string; expiresAt: Date }> {
    await this.getStudentById(studentId);
    const botUsername = this.config.get<string>("TELEGRAM_BOT_USERNAME")?.trim().replace(/^@/, "");
    if (!botUsername) {
      throw new ServiceUnavailableException("TELEGRAM_BOT_USERNAME is not configured");
    }
    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const db = this.getDb();
    await db.delete(telegramLinkTokens).where(eq(telegramLinkTokens.studentId, studentId));
    await db.insert(telegramLinkTokens).values({ token, studentId, expiresAt });
    const deepLink = `https://t.me/${botUsername}?start=${token}`;
    return { deepLink, expiresAt };
  }

  /** Called by the Telegram bot when the user taps /start with a link token. */
  async linkTelegramAccountFromToken(token: string, telegramUserId: string): Promise<void> {
    const trimmedToken = token.trim();
    const trimmedTg = telegramUserId.trim();
    if (!trimmedToken || !trimmedTg) {
      throw new BadRequestException("Invalid link");
    }
    const db = this.getDb();
    const rows = await db
      .select()
      .from(telegramLinkTokens)
      .where(eq(telegramLinkTokens.token, trimmedToken))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new NotFoundException("Invalid or expired link");
    }
    if (new Date() > row.expiresAt) {
      await db.delete(telegramLinkTokens).where(eq(telegramLinkTokens.id, row.id));
      throw new BadRequestException("Link expired");
    }
    const student = await this.getStudentById(row.studentId);
    const existing = await this.findByTelegramId(trimmedTg);
    if (existing && existing.id !== student.id) {
      throw new ConflictException("Telegram account is already linked to another student");
    }
    await db.update(users).set({ telegramId: trimmedTg }).where(eq(users.id, student.id));
    await db.delete(telegramLinkTokens).where(eq(telegramLinkTokens.id, row.id));
  }
}

