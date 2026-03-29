import { ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import type { DrizzleDb, NewUser, User } from "../db";
import { users } from "../db";
import { DRIZZLE_DB } from "../db/tokens";

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null) {}

  private getDb(): DrizzleDb {
    if (!this.db) throw new ServiceUnavailableException("Database is not configured");
    return this.db;
  }

  async findByLogin(login: string): Promise<User | null> {
    const db = this.getDb();
    const rows = await db.select().from(users).where(eq(users.login, login)).limit(1);
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

  async updateStudent(input: { studentId: string; login?: string; password?: string }): Promise<User> {
    const db = this.getDb();
    const current = await this.getStudentById(input.studentId);

    if (input.login && input.login !== current.login) {
      const existing = await this.findByLogin(input.login);
      if (existing && existing.id !== current.id) throw new ConflictException("Login is already taken");
    }

    const rows = await db
      .update(users)
      .set({
        ...(input.login ? { login: input.login } : {}),
        ...(input.password ? { password: input.password } : {}),
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
}

