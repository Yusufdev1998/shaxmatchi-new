import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import type { DrizzleDb } from "../db";
import { courses, debutLevels, modules, puzzleAssignments, puzzles, tasks, users } from "../db/schema";
import { DRIZZLE_DB } from "../db/tokens";
import { TelegramBotService } from "../telegram/telegram-bot.service";

/** When a study assignment's deadline expires, we flip it to practice with this many attempts. */
const STUDY_EXPIRY_PRACTICE_LIMIT = 10;

@Injectable()
export class DebutsService {
  private readonly logger = new Logger(DebutsService.name);
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null,
    private readonly telegramBot: TelegramBotService,
  ) {}

  private getDb(): DrizzleDb {
    if (!this.db) throw new ServiceUnavailableException("Database is not configured");
    return this.db;
  }

  // Debut levels
  listLevels() {
    return this.getDb().select().from(debutLevels);
  }

  async getLevel(id: string) {
    const rows = await this.getDb().select().from(debutLevels).where(eq(debutLevels.id, id)).limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException("Debut level not found");
    return row;
  }

  async createLevel(name: string) {
    const rows = await this.getDb().insert(debutLevels).values({ name }).returning();
    return rows[0]!;
  }

  async updateLevel(id: string, name: string) {
    const rows = await this.getDb()
      .update(debutLevels)
      .set({ name })
      .where(eq(debutLevels.id, id))
      .returning();
    const row = rows[0];
    if (!row) throw new NotFoundException("Debut level not found");
    return row;
  }

  async deleteLevel(id: string) {
    const rows = await this.getDb().delete(debutLevels).where(eq(debutLevels.id, id)).returning();
    const row = rows[0];
    if (!row) throw new NotFoundException("Debut level not found");
    return { ok: true };
  }

  // Courses
  async listCourses(levelId: string) {
    await this.getLevel(levelId);
    return this.getDb().select().from(courses).where(eq(courses.debutLevelId, levelId));
  }

  async createCourse(levelId: string, name: string) {
    await this.getLevel(levelId);
    const rows = await this.getDb().insert(courses).values({ debutLevelId: levelId, name }).returning();
    return rows[0]!;
  }

  async updateCourse(levelId: string, courseId: string, name: string) {
    await this.getLevel(levelId);
    const rows = await this.getDb()
      .update(courses)
      .set({ name })
      .where(and(eq(courses.id, courseId), eq(courses.debutLevelId, levelId)))
      .returning();
    const row = rows[0];
    if (!row) throw new NotFoundException("Course not found");
    return row;
  }

  async deleteCourse(levelId: string, courseId: string) {
    await this.getLevel(levelId);
    const rows = await this.getDb()
      .delete(courses)
      .where(and(eq(courses.id, courseId), eq(courses.debutLevelId, levelId)))
      .returning();
    const row = rows[0];
    if (!row) throw new NotFoundException("Course not found");
    return { ok: true };
  }

  // Modules
  private async getCourse(levelId: string, courseId: string) {
    await this.getLevel(levelId);
    const rows = await this.getDb()
      .select()
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.debutLevelId, levelId)))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException("Course not found");
    return row;
  }

  async listModules(levelId: string, courseId: string) {
    await this.getCourse(levelId, courseId);
    return this.getDb().select().from(modules).where(eq(modules.courseId, courseId));
  }

  async createModule(levelId: string, courseId: string, name: string) {
    await this.getCourse(levelId, courseId);
    const rows = await this.getDb().insert(modules).values({ courseId, name }).returning();
    return rows[0]!;
  }

  async updateModule(levelId: string, courseId: string, moduleId: string, name: string) {
    await this.getCourse(levelId, courseId);
    const rows = await this.getDb()
      .update(modules)
      .set({ name })
      .where(and(eq(modules.id, moduleId), eq(modules.courseId, courseId)))
      .returning();
    const row = rows[0];
    if (!row) throw new NotFoundException("Module not found");
    return row;
  }

  async deleteModule(levelId: string, courseId: string, moduleId: string) {
    await this.getCourse(levelId, courseId);
    const rows = await this.getDb()
      .delete(modules)
      .where(and(eq(modules.id, moduleId), eq(modules.courseId, courseId)))
      .returning();
    const row = rows[0];
    if (!row) throw new NotFoundException("Module not found");
    return { ok: true };
  }

  // Tasks
  private async getModule(levelId: string, courseId: string, moduleId: string) {
    await this.getCourse(levelId, courseId);
    const rows = await this.getDb()
      .select()
      .from(modules)
      .where(and(eq(modules.id, moduleId), eq(modules.courseId, courseId)))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException("Module not found");
    return row;
  }

  async listTasks(levelId: string, courseId: string, moduleId: string) {
    await this.getModule(levelId, courseId, moduleId);
    return this.getDb().select().from(tasks).where(eq(tasks.moduleId, moduleId));
  }

  async createTask(levelId: string, courseId: string, moduleId: string, name: string) {
    await this.getModule(levelId, courseId, moduleId);
    const rows = await this.getDb().insert(tasks).values({ moduleId, name }).returning();
    return rows[0]!;
  }

  async updateTask(levelId: string, courseId: string, moduleId: string, taskId: string, name: string) {
    await this.getModule(levelId, courseId, moduleId);
    const rows = await this.getDb()
      .update(tasks)
      .set({ name })
      .where(and(eq(tasks.id, taskId), eq(tasks.moduleId, moduleId)))
      .returning();
    const row = rows[0];
    if (!row) throw new NotFoundException("Task not found");
    return row;
  }

  async deleteTask(levelId: string, courseId: string, moduleId: string, taskId: string) {
    await this.getModule(levelId, courseId, moduleId);
    const rows = await this.getDb()
      .delete(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.moduleId, moduleId)))
      .returning();
    const row = rows[0];
    if (!row) throw new NotFoundException("Task not found");
    return { ok: true };
  }

  /** Flat list of all tasks with their full debut hierarchy path, for cross-hierarchy pickers (e.g. exams). */
  async listAllTasksWithPath() {
    const db = this.getDb();
    return db
      .select({
        taskId: tasks.id,
        taskName: tasks.name,
        moduleId: modules.id,
        moduleName: modules.name,
        courseId: courses.id,
        courseName: courses.name,
        levelId: debutLevels.id,
        levelName: debutLevels.name,
      })
      .from(tasks)
      .innerJoin(modules, eq(modules.id, tasks.moduleId))
      .innerJoin(courses, eq(courses.id, modules.courseId))
      .innerJoin(debutLevels, eq(debutLevels.id, courses.debutLevelId))
      .orderBy(
        asc(debutLevels.createdAt),
        asc(courses.createdAt),
        asc(modules.createdAt),
        asc(tasks.createdAt),
      );
  }

  // Puzzles
  private async getTask(levelId: string, courseId: string, moduleId: string, taskId: string) {
    await this.getModule(levelId, courseId, moduleId);
    const rows = await this.getDb()
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.moduleId, moduleId)))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException("Task not found");
    return row;
  }

  private async getPuzzle(
    levelId: string,
    courseId: string,
    moduleId: string,
    taskId: string,
    puzzleId: string,
  ) {
    await this.getTask(levelId, courseId, moduleId, taskId);
    const rows = await this.getDb()
      .select()
      .from(puzzles)
      .where(and(eq(puzzles.id, puzzleId), eq(puzzles.taskId, taskId)))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException("Variant not found");
    return row;
  }

  async listPuzzles(levelId: string, courseId: string, moduleId: string, taskId: string) {
    await this.getTask(levelId, courseId, moduleId, taskId);
    return this.getDb()
      .select()
      .from(puzzles)
      .where(eq(puzzles.taskId, taskId))
      .orderBy(asc(puzzles.sortOrder), asc(puzzles.createdAt));
  }

  async createPuzzle(
    levelId: string,
    courseId: string,
    moduleId: string,
    taskId: string,
    input: {
      name: string;
      moves: Array<{
        san: string;
        explanation: string;
        circles?: Array<{ square: string; color?: string }>;
        arrows?: Array<{ startSquare: string; endSquare: string; color?: string }>;
        audioUrl?: string;
      }>;
      studentSide?: "white" | "black";
    },
  ) {
    await this.getTask(levelId, courseId, moduleId, taskId);
    const studentSide = input.studentSide ?? "white";
    const [{ nextOrder }] = await this.getDb()
      .select({ nextOrder: sql<number>`COALESCE(MAX(${puzzles.sortOrder}), -1) + 1` })
      .from(puzzles)
      .where(eq(puzzles.taskId, taskId));
    const rows = await this.getDb()
      .insert(puzzles)
      .values({ taskId, name: input.name, moves: input.moves, studentSide, sortOrder: nextOrder })
      .returning();
    return rows[0]!;
  }

  async updatePuzzle(
    levelId: string,
    courseId: string,
    moduleId: string,
    taskId: string,
    puzzleId: string,
    input: {
      name: string;
      moves: Array<{
        san: string;
        explanation: string;
        circles?: Array<{ square: string; color?: string }>;
        arrows?: Array<{ startSquare: string; endSquare: string; color?: string }>;
        audioUrl?: string;
      }>;
      studentSide?: "white" | "black";
    },
  ) {
    await this.getTask(levelId, courseId, moduleId, taskId);
    const rows = await this.getDb()
      .update(puzzles)
      .set({
        name: input.name,
        moves: input.moves,
        ...(input.studentSide !== undefined ? { studentSide: input.studentSide } : {}),
      })
      .where(and(eq(puzzles.id, puzzleId), eq(puzzles.taskId, taskId)))
      .returning();
    const row = rows[0];
    if (!row) throw new NotFoundException("Variant not found");
    return row;
  }

  async deletePuzzle(levelId: string, courseId: string, moduleId: string, taskId: string, puzzleId: string) {
    await this.getTask(levelId, courseId, moduleId, taskId);
    const rows = await this.getDb()
      .delete(puzzles)
      .where(and(eq(puzzles.id, puzzleId), eq(puzzles.taskId, taskId)))
      .returning();
    const row = rows[0];
    if (!row) throw new NotFoundException("Variant not found");
    return { ok: true };
  }

  async reorderPuzzles(
    levelId: string,
    courseId: string,
    moduleId: string,
    taskId: string,
    puzzleIds: string[],
  ) {
    await this.getTask(levelId, courseId, moduleId, taskId);
    const db = this.getDb();
    const existing = await db
      .select({ id: puzzles.id })
      .from(puzzles)
      .where(and(eq(puzzles.taskId, taskId), inArray(puzzles.id, puzzleIds)));
    if (existing.length !== puzzleIds.length) {
      throw new NotFoundException("One or more variants not found for this task");
    }
    await db.transaction(async (tx) => {
      for (let i = 0; i < puzzleIds.length; i++) {
        await tx
          .update(puzzles)
          .set({ sortOrder: i })
          .where(and(eq(puzzles.id, puzzleIds[i]!), eq(puzzles.taskId, taskId)));
      }
    });
    return { ok: true };
  }

  async assignPuzzle(input: {
    levelId: string;
    courseId: string;
    moduleId: string;
    taskId: string;
    puzzleId: string;
    teacherId: string;
    studentId: string;
    mode: "new" | "test";
    practiceLimit: number | null;
    dueInHours: number | null;
  }) {
    const db = this.getDb();
    const puzzle = await this.getPuzzle(input.levelId, input.courseId, input.moduleId, input.taskId, input.puzzleId);

    const studentRows = await db
      .select({ id: users.id, type: users.type, telegramId: users.telegramId })
      .from(users)
      .where(eq(users.id, input.studentId))
      .limit(1);
    const student = studentRows[0];
    if (!student || student.type !== "student") throw new NotFoundException("Student not found");

    const existingRows = await db
      .select({ id: puzzleAssignments.id })
      .from(puzzleAssignments)
      .where(and(eq(puzzleAssignments.puzzleId, input.puzzleId), eq(puzzleAssignments.studentId, input.studentId)))
      .limit(1);
    const existing = existingRows[0];

    const dueAtForMode: Date | null =
      input.mode === "new" && input.dueInHours && input.dueInHours > 0
        ? new Date(Date.now() + input.dueInHours * 3600 * 1000)
        : null;

    let assignment;
    if (existing) {
      const rows = await db
        .update(puzzleAssignments)
        .set({
          teacherId: input.teacherId,
          mode: input.mode,
          practiceLimit: input.mode === "test" ? input.practiceLimit : null,
          practiceAttemptsUsed: 0,
          practiceSuccessCount: 0,
          practiceFailureProgressSum: 0,
          learningSecondsTotal: 0,
          dueAt: dueAtForMode,
          assignedAt: new Date(),
          completedAt: null,
        })
        .where(eq(puzzleAssignments.id, existing.id))
        .returning();
      assignment = rows[0]!;
    } else {
      const rows = await db
        .insert(puzzleAssignments)
        .values({
          puzzleId: input.puzzleId,
          teacherId: input.teacherId,
          studentId: input.studentId,
          mode: input.mode,
          practiceLimit: input.mode === "test" ? input.practiceLimit : null,
          practiceAttemptsUsed: 0,
          practiceSuccessCount: 0,
          practiceFailureProgressSum: 0,
          dueAt: dueAtForMode,
        })
        .returning();
      assignment = rows[0]!;
    }

    if (student.telegramId) {
      const isPractice = input.mode === "test";
      const modeEmoji = isPractice ? "🎯" : "📖";
      const modeLabel = isPractice ? "Mashq" : "O'rganish";
      const headerEmoji = isPractice ? "🎯" : "📘";
      const deadlineLine =
        dueAtForMode && input.dueInHours
          ? `⏰ Muddat: ${input.dueInHours} soat ichida\n`
          : "";
      const message =
        `${headerEmoji} Sizga yangi variant tayinlandi\n\n` +
        `Nomi: ${puzzle.name}\n` +
        `Rejim: ${modeEmoji} ${modeLabel}\n` +
        deadlineLine +
        `\nShaxmatchini ochib mashg'ulotni boshlang.`;

      const spokenDeadline =
        dueAtForMode && input.dueInHours ? ` Muddat: ${input.dueInHours} soat ichida.` : "";
      const spokenText =
        `Sizga yangi variant tayinlandi. Nomi: ${puzzle.name}. Rejim: ${modeLabel}.` +
        spokenDeadline +
        ` Shaxmatchini ochib mashg'ulotni boshlang.`;

      const studentTelegramId = student.telegramId;
      const studentId = input.studentId;
      void (async () => {
        const voiceSent = await this.telegramBot.sendSpokenMessage(
          studentTelegramId,
          spokenText,
          { caption: message },
        );
        if (!voiceSent) {
          await this.telegramBot.sendMessage(studentTelegramId, message).catch((err) => {
            this.logger.warn(
              `assignPuzzle notify fallback failed (student=${studentId}): ${err instanceof Error ? err.message : String(err)}`,
            );
          });
        }
      })();
    }

    return assignment;
  }

  /**
   * Every 5 minutes, flip study-mode assignments whose deadline has passed to
   * practice mode with a default attempts limit, and notify each student.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepExpiredStudyAssignments(): Promise<void> {
    if (!this.db) return;
    const db = this.getDb();
    const now = new Date();

    const expired = await db
      .select({
        assignmentId: puzzleAssignments.id,
        studentId: puzzleAssignments.studentId,
        puzzleName: puzzles.name,
        studentTelegramId: users.telegramId,
      })
      .from(puzzleAssignments)
      .innerJoin(puzzles, eq(puzzles.id, puzzleAssignments.puzzleId))
      .innerJoin(users, eq(users.id, puzzleAssignments.studentId))
      .where(
        and(
          eq(puzzleAssignments.mode, "new"),
          isNotNull(puzzleAssignments.dueAt),
          lte(puzzleAssignments.dueAt, now),
          isNull(puzzleAssignments.completedAt),
        ),
      );

    if (expired.length === 0) return;

    const ids = expired.map((r) => r.assignmentId);
    await db
      .update(puzzleAssignments)
      .set({
        mode: "test",
        practiceLimit: STUDY_EXPIRY_PRACTICE_LIMIT,
        practiceAttemptsUsed: 0,
        practiceSuccessCount: 0,
        practiceFailureProgressSum: 0,
        dueAt: null,
        assignedAt: now,
      })
      .where(inArray(puzzleAssignments.id, ids));

    this.logger.log(`Flipped ${expired.length} study assignment(s) to practice mode after deadline.`);

    for (const row of expired) {
      if (!row.studentTelegramId) continue;
      const message =
        `🎯 O'rganish muddati tugadi\n\n` +
        `Nomi: ${row.puzzleName}\n` +
        `Rejim: 🎯 Mashq\n` +
        `Urinishlar: ${STUDY_EXPIRY_PRACTICE_LIMIT}\n\n` +
        `Shaxmatchini ochib mashq qilishni boshlang.`;
      const spokenText =
        `O'rganish muddati tugadi. Nomi: ${row.puzzleName}. Endi mashq rejimiga o'tdingiz. ` +
        `Sizda ${STUDY_EXPIRY_PRACTICE_LIMIT} ta urinish bor. Shaxmatchini ochib mashq qilishni boshlang.`;

      const telegramId = row.studentTelegramId;
      const studentId = row.studentId;
      void (async () => {
        const voiceSent = await this.telegramBot.sendSpokenMessage(telegramId, spokenText, {
          caption: message,
        });
        if (!voiceSent) {
          await this.telegramBot.sendMessage(telegramId, message).catch((err) => {
            this.logger.warn(
              `sweepExpiredStudyAssignments notify fallback failed (student=${studentId}): ${err instanceof Error ? err.message : String(err)}`,
            );
          });
        }
      })();
    }
  }

  async listPuzzleAssignments(input: {
    levelId: string;
    courseId: string;
    moduleId: string;
    taskId: string;
    puzzleId: string;
  }) {
    const db = this.getDb();
    await this.getPuzzle(input.levelId, input.courseId, input.moduleId, input.taskId, input.puzzleId);

    const rows = await db
      .select({
        id: puzzleAssignments.id,
        puzzleId: puzzleAssignments.puzzleId,
        teacherId: puzzleAssignments.teacherId,
        studentId: puzzleAssignments.studentId,
        studentLogin: users.login,
        mode: puzzleAssignments.mode,
        practiceLimit: puzzleAssignments.practiceLimit,
        practiceAttemptsUsed: puzzleAssignments.practiceAttemptsUsed,
        practiceSuccessCount: puzzleAssignments.practiceSuccessCount,
        practiceFailureProgressSum: puzzleAssignments.practiceFailureProgressSum,
        learningSecondsTotal: puzzleAssignments.learningSecondsTotal,
        dueAt: puzzleAssignments.dueAt,
        assignedAt: puzzleAssignments.assignedAt,
        completedAt: puzzleAssignments.completedAt,
      })
      .from(puzzleAssignments)
      .innerJoin(users, eq(puzzleAssignments.studentId, users.id))
      .where(eq(puzzleAssignments.puzzleId, input.puzzleId))
      .orderBy(desc(puzzleAssignments.assignedAt));

    return rows;
  }

  async deletePuzzleAssignment(input: {
    levelId: string;
    courseId: string;
    moduleId: string;
    taskId: string;
    puzzleId: string;
    assignmentId: string;
  }) {
    const db = this.getDb();
    await this.getPuzzle(input.levelId, input.courseId, input.moduleId, input.taskId, input.puzzleId);

    const existing = await db
      .select({ id: puzzleAssignments.id })
      .from(puzzleAssignments)
      .where(and(eq(puzzleAssignments.id, input.assignmentId), eq(puzzleAssignments.puzzleId, input.puzzleId)))
      .limit(1);
    if (!existing[0]) throw new NotFoundException("Assignment not found");

    await db.delete(puzzleAssignments).where(eq(puzzleAssignments.id, input.assignmentId));
    return { ok: true as const };
  }
}

