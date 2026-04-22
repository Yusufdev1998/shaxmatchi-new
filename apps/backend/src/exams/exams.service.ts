import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleDb } from "../db";
import { examAssignments, examAttempts, examTasks, exams, tasks, users } from "../db/schema";
import { DRIZZLE_DB } from "../db/tokens";
import { TelegramBotService } from "../telegram/telegram-bot.service";

@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null,
    private readonly telegramBot: TelegramBotService,
  ) {}

  private getDb(): DrizzleDb {
    if (!this.db) throw new ServiceUnavailableException("Database is not configured");
    return this.db;
  }

  async listExams() {
    return this.getDb().select().from(exams).orderBy(desc(exams.createdAt));
  }

  async getExam(examId: string) {
    const db = this.getDb();
    const rows = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
    const exam = rows[0];
    if (!exam) throw new NotFoundException("Exam not found");
    const taskRows = await db
      .select({ taskId: examTasks.taskId })
      .from(examTasks)
      .where(eq(examTasks.examId, examId));
    return { ...exam, taskIds: taskRows.map((r) => r.taskId) };
  }

  async createExam(
    teacherId: string,
    input: {
      name: string;
      secondsPerMove: number;
      attemptsAllowed: number;
      puzzleCount: number;
      taskIds: string[];
    },
  ) {
    const db = this.getDb();
    await this.ensureTasksExist(input.taskIds);

    const [exam] = await db
      .insert(exams)
      .values({
        name: input.name,
        createdBy: teacherId,
        secondsPerMove: input.secondsPerMove,
        attemptsAllowed: input.attemptsAllowed,
        puzzleCount: input.puzzleCount,
      })
      .returning();
    if (!exam) throw new ServiceUnavailableException("Failed to create exam");

    await db
      .insert(examTasks)
      .values(input.taskIds.map((taskId) => ({ examId: exam.id, taskId })));
    return { ...exam, taskIds: input.taskIds };
  }

  async updateExam(
    examId: string,
    input: {
      name: string;
      secondsPerMove: number;
      attemptsAllowed: number;
      puzzleCount: number;
      taskIds: string[];
    },
  ) {
    const db = this.getDb();
    await this.ensureTasksExist(input.taskIds);

    const [exam] = await db
      .update(exams)
      .set({
        name: input.name,
        secondsPerMove: input.secondsPerMove,
        attemptsAllowed: input.attemptsAllowed,
        puzzleCount: input.puzzleCount,
      })
      .where(eq(exams.id, examId))
      .returning();
    if (!exam) throw new NotFoundException("Exam not found");

    await db.delete(examTasks).where(eq(examTasks.examId, examId));
    await db
      .insert(examTasks)
      .values(input.taskIds.map((taskId) => ({ examId: exam.id, taskId })));

    return { ...exam, taskIds: input.taskIds };
  }

  async deleteExam(examId: string) {
    const db = this.getDb();
    const rows = await db.delete(exams).where(eq(exams.id, examId)).returning();
    if (!rows[0]) throw new NotFoundException("Exam not found");
    return { ok: true as const };
  }

  async listExamAssignments(examId: string) {
    const db = this.getDb();
    await this.getExam(examId);
    return db
      .select({
        id: examAssignments.id,
        examId: examAssignments.examId,
        teacherId: examAssignments.teacherId,
        studentId: examAssignments.studentId,
        studentLogin: users.login,
        attemptsUsed: examAssignments.attemptsUsed,
        assignedAt: examAssignments.assignedAt,
        passed: sql<number>`(SELECT COUNT(*)::int FROM ${examAttempts} WHERE ${examAttempts.assignmentId} = ${examAssignments.id} AND ${examAttempts.status} = 'passed')`,
        failed: sql<number>`(SELECT COUNT(*)::int FROM ${examAttempts} WHERE ${examAttempts.assignmentId} = ${examAssignments.id} AND ${examAttempts.status} = 'failed')`,
        lastResult: sql<"passed" | "failed" | null>`(SELECT status FROM ${examAttempts} WHERE ${examAttempts.assignmentId} = ${examAssignments.id} AND ${examAttempts.status} != 'in_progress' ORDER BY started_at DESC LIMIT 1)`,
      })
      .from(examAssignments)
      .innerJoin(users, eq(examAssignments.studentId, users.id))
      .where(eq(examAssignments.examId, examId))
      .orderBy(desc(examAssignments.assignedAt));
  }

  async assignExam(input: { examId: string; teacherId: string; studentIds: string[] }) {
    const db = this.getDb();
    const exam = await this.getExam(input.examId);

    const studentRows = await db
      .select({ id: users.id, type: users.type, telegramId: users.telegramId })
      .from(users)
      .where(inArray(users.id, input.studentIds));
    const missing = input.studentIds.filter(
      (id) => !studentRows.find((s) => s.id === id && s.type === "student"),
    );
    if (missing.length > 0) throw new NotFoundException(`Student(s) not found: ${missing.join(", ")}`);

    const existingRows = await db
      .select({ id: examAssignments.id, studentId: examAssignments.studentId })
      .from(examAssignments)
      .where(
        and(
          eq(examAssignments.examId, input.examId),
          inArray(examAssignments.studentId, input.studentIds),
        ),
      );
    const existingByStudent = new Map(existingRows.map((r) => [r.studentId, r.id]));

    const created: Array<{ id: string; studentId: string }> = [];
    const updated: Array<{ id: string; studentId: string }> = [];
    for (const studentId of input.studentIds) {
      const existingId = existingByStudent.get(studentId);
      if (existingId) {
        await db
          .update(examAssignments)
          .set({ teacherId: input.teacherId, attemptsUsed: 0, assignedAt: new Date() })
          .where(eq(examAssignments.id, existingId));
        updated.push({ id: existingId, studentId });
      } else {
        const [row] = await db
          .insert(examAssignments)
          .values({
            examId: input.examId,
            teacherId: input.teacherId,
            studentId,
          })
          .returning();
        if (row) created.push({ id: row.id, studentId });
      }
    }

    const message =
      `🧪 Sizga yangi imtihon tayinlandi\n\n` +
      `Nomi: ${exam.name}\n` +
      `Har yurishga: ${exam.secondsPerMove} soniya\n` +
      `Urinishlar: ${exam.attemptsAllowed}\n` +
      `Pazllar soni: ${exam.puzzleCount}\n\n` +
      `Shaxmatchini ochib imtihonni boshlang.`;
    const spokenText =
      `Sizga yangi imtihon tayinlandi. Nomi: ${exam.name}. ` +
      `Har yurishga ${exam.secondsPerMove} soniya beriladi. ` +
      `${exam.attemptsAllowed} ta urinish bor. Har imtihonda ${exam.puzzleCount} ta pazl bo'ladi. ` +
      `Shaxmatchini ochib imtihonni boshlang.`;

    for (const studentId of input.studentIds) {
      const student = studentRows.find((s) => s.id === studentId);
      if (!student?.telegramId) continue;
      const telegramId = student.telegramId;
      void (async () => {
        const voiceSent = await this.telegramBot.sendSpokenMessage(telegramId, spokenText, {
          caption: message,
        });
        if (!voiceSent) {
          await this.telegramBot.sendMessage(telegramId, message).catch((err) => {
            this.logger.warn(
              `assignExam notify fallback failed (student=${studentId}): ${err instanceof Error ? err.message : String(err)}`,
            );
          });
        }
      })();
    }

    return { created: created.length, updated: updated.length };
  }

  async unassignExam(examId: string, assignmentId: string) {
    const db = this.getDb();
    const rows = await db
      .delete(examAssignments)
      .where(and(eq(examAssignments.id, assignmentId), eq(examAssignments.examId, examId)))
      .returning();
    if (!rows[0]) throw new NotFoundException("Assignment not found");
    return { ok: true as const };
  }

  private async ensureTasksExist(taskIds: string[]) {
    if (taskIds.length === 0) throw new BadRequestException("At least one task is required");
    const db = this.getDb();
    const found = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(inArray(tasks.id, taskIds));
    const foundSet = new Set(found.map((r) => r.id));
    const missing = taskIds.filter((id) => !foundSet.has(id));
    if (missing.length > 0) throw new NotFoundException(`Task(s) not found: ${missing.join(", ")}`);
  }
}
