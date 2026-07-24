import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { and, asc, eq, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import type { DrizzleDb } from "../db";
import { puzzleAssignments, puzzles, users } from "../db/schema";
import { DRIZZLE_DB } from "../db/tokens";
import { TelegramBotService } from "../telegram/telegram-bot.service";

/** Mashq attempts granted when neither the teacher nor an earlier round set a limit. */
export const DEFAULT_PRACTICE_LIMIT = 10;
/** O'rganish window (hours) used when the teacher never set one but the cycle needs a deadline. */
export const DEFAULT_STUDY_HOURS = 24;

export type PuzzleCycleOutcome =
  /** The mashq round is still running — attempts remain. */
  | { status: "in_progress" }
  /** Every attempt of the round was correct: this variant is done. */
  | {
      status: "passed";
      nextPuzzle: { id: string; name: string } | null;
      taskCompleted: boolean;
    }
  /** The round ended with at least one wrong attempt: back to o'rganish. */
  | { status: "reverted"; dueAt: Date; studyHours: number };

@Injectable()
export class PuzzleCycleService {
  private readonly logger = new Logger(PuzzleCycleService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null,
    private readonly telegramBot: TelegramBotService,
  ) {}

  /** Fire-and-forget Telegram notification: spoken first (young students), typed as fallback. */
  private notifyStudent(input: {
    telegramId: string | null;
    studentId: string;
    message: string;
    spokenText: string;
    context: string;
  }): void {
    if (!input.telegramId) return;
    const telegramId = input.telegramId;
    void (async () => {
      const voiceSent = await this.telegramBot.sendSpokenMessage(telegramId, input.spokenText, {
        caption: input.message,
      });
      if (!voiceSent) {
        await this.telegramBot.sendMessage(telegramId, input.message).catch((err) => {
          this.logger.warn(
            `${input.context} notify fallback failed (student=${input.studentId}): ${err instanceof Error ? err.message : String(err)}`,
          );
        });
      }
    })();
  }

  /**
   * Every 5 minutes, flip o'rganish assignments whose deadline has passed to mashq mode
   * (reusing the teacher's remembered attempts limit), and notify each student.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sweepExpiredStudyAssignments(): Promise<void> {
    if (!this.db) return;
    const db = this.db;
    const now = new Date();

    const expired = await db
      .select({
        assignmentId: puzzleAssignments.id,
        studentId: puzzleAssignments.studentId,
        practiceLimit: sql<number>`COALESCE(${puzzleAssignments.cyclePracticeLimit}, ${DEFAULT_PRACTICE_LIMIT})`,
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
        practiceLimit: sql`COALESCE(${puzzleAssignments.cyclePracticeLimit}, ${DEFAULT_PRACTICE_LIMIT})`,
        practiceAttemptsUsed: 0,
        practiceSuccessCount: 0,
        practiceFailureProgressSum: 0,
        dueAt: null,
        assignedAt: now,
      })
      .where(inArray(puzzleAssignments.id, ids));

    this.logger.log(`Flipped ${expired.length} study assignment(s) to practice mode after deadline.`);

    for (const row of expired) {
      const limit = Number(row.practiceLimit) || DEFAULT_PRACTICE_LIMIT;
      this.notifyStudent({
        telegramId: row.studentTelegramId,
        studentId: row.studentId,
        context: "sweepExpiredStudyAssignments",
        message:
          `🎯 O'rganish muddati tugadi\n\n` +
          `Nomi: ${row.puzzleName}\n` +
          `Rejim: 🎯 Mashq\n` +
          `Urinishlar: ${limit}\n\n` +
          `Barcha urinishni xatosiz bajarsangiz, keyingi variant ochiladi.`,
        spokenText:
          `O'rganish muddati tugadi. Nomi: ${row.puzzleName}. Endi mashq rejimiga o'tdingiz. ` +
          `Sizda ${limit} ta urinish bor. Barcha urinishni xatosiz bajarsangiz, keyingi variant ochiladi.`,
      });
    }
  }

  /**
   * Called after every consumed mashq attempt. While attempts remain nothing happens; once the
   * round is used up the assignment either passes (all attempts correct → variant completed and
   * the next variant of the task opens in o'rganish mode) or is reverted to o'rganish so the
   * student can study and retry. The cycle repeats until every variant of the task is passed.
   */
  async evaluatePracticeCycle(assignmentId: string): Promise<PuzzleCycleOutcome> {
    if (!this.db) return { status: "in_progress" };
    const db = this.db;

    const rows = await db
      .select({
        id: puzzleAssignments.id,
        puzzleId: puzzleAssignments.puzzleId,
        teacherId: puzzleAssignments.teacherId,
        studentId: puzzleAssignments.studentId,
        mode: puzzleAssignments.mode,
        practiceLimit: puzzleAssignments.practiceLimit,
        practiceAttemptsUsed: puzzleAssignments.practiceAttemptsUsed,
        practiceSuccessCount: puzzleAssignments.practiceSuccessCount,
        studyHours: puzzleAssignments.studyHours,
        cyclePracticeLimit: puzzleAssignments.cyclePracticeLimit,
        completedAt: puzzleAssignments.completedAt,
        puzzleName: puzzles.name,
        taskId: puzzles.taskId,
        sortOrder: puzzles.sortOrder,
        puzzleCreatedAt: puzzles.createdAt,
        studentTelegramId: users.telegramId,
      })
      .from(puzzleAssignments)
      .innerJoin(puzzles, eq(puzzles.id, puzzleAssignments.puzzleId))
      .innerJoin(users, eq(users.id, puzzleAssignments.studentId))
      .where(eq(puzzleAssignments.id, assignmentId))
      .limit(1);

    const a = rows[0];
    if (!a) return { status: "in_progress" };
    if (a.mode !== "test" || a.completedAt) return { status: "in_progress" };

    // Unlimited mashq (teacher set no limit) has no round boundary — stays manual.
    const limit = a.practiceLimit;
    if (limit === null) return { status: "in_progress" };

    const used = a.practiceAttemptsUsed ?? 0;
    if (used < limit) return { status: "in_progress" };

    const allCorrect = (a.practiceSuccessCount ?? 0) >= limit;
    const studyHours = a.studyHours ?? DEFAULT_STUDY_HOURS;

    return allCorrect
      ? this.passAssignment({ ...a, studyHours, limit })
      : this.revertAssignmentToStudy({ ...a, studyHours, limit });
  }

  /** All attempts correct: complete this variant and open the task's next variant in o'rganish. */
  private async passAssignment(a: {
    id: string;
    puzzleId: string;
    teacherId: string;
    studentId: string;
    puzzleName: string;
    taskId: string;
    sortOrder: number;
    puzzleCreatedAt: Date;
    studentTelegramId: string | null;
    cyclePracticeLimit: number | null;
    studyHours: number;
    limit: number;
  }): Promise<PuzzleCycleOutcome> {
    const db = this.db!;
    const now = new Date();

    // Claim the round: a second concurrent attempt for the same assignment finds it completed
    // and does nothing, so the next variant is opened exactly once.
    const claimed = await db
      .update(puzzleAssignments)
      .set({ completedAt: now, dueAt: null })
      .where(and(eq(puzzleAssignments.id, a.id), isNull(puzzleAssignments.completedAt)))
      .returning({ id: puzzleAssignments.id });
    if (claimed.length === 0) return { status: "in_progress" };

    const next = await this.openNextPuzzle(a, now);

    this.logger.log(
      next
        ? `Assignment ${a.id} passed (${a.limit}/${a.limit}); opened next variant ${next.id} in study mode.`
        : `Assignment ${a.id} passed (${a.limit}/${a.limit}); task ${a.taskId} finished for student ${a.studentId}.`,
    );

    if (next) {
      this.notifyStudent({
        telegramId: a.studentTelegramId,
        studentId: a.studentId,
        context: "puzzleCycle.pass",
        message:
          `🎉 Barakalla! Variant bajarildi\n\n` +
          `Nomi: ${a.puzzleName}\n` +
          `Barcha ${a.limit} ta urinish xatosiz!\n\n` +
          `📘 Keyingi variant ochildi: ${next.name}\n` +
          `⏰ O'rganish muddati: ${a.studyHours} soat`,
        spokenText:
          `Barakalla! ${a.puzzleName} variantini barcha urinishlarda xatosiz bajardingiz. ` +
          `Keyingi variant ochildi: ${next.name}. O'rganish muddati ${a.studyHours} soat. ` +
          `Shaxmatchini ochib o'rganishni boshlang.`,
      });
    } else {
      this.notifyStudent({
        telegramId: a.studentTelegramId,
        studentId: a.studentId,
        context: "puzzleCycle.taskCompleted",
        message:
          `🏆 Vazifa to'liq bajarildi!\n\n` +
          `Oxirgi variant: ${a.puzzleName}\n` +
          `Ushbu vazifadagi barcha variantlarni muvaffaqiyatli yakunladingiz.`,
        spokenText:
          `Tabriklaymiz! ${a.puzzleName} variantini ham xatosiz bajardingiz. ` +
          `Ushbu vazifadagi barcha variantlarni muvaffaqiyatli yakunladingiz.`,
      });
    }

    return {
      status: "passed",
      nextPuzzle: next ? { id: next.id, name: next.name } : null,
      taskCompleted: next === null,
    };
  }

  /**
   * Opens the first not-yet-passed variant that follows this one in the task. Returns null when
   * the task has no variant left — i.e. the student finished the whole task.
   */
  private async openNextPuzzle(
    a: {
      id: string;
      puzzleId: string;
      teacherId: string;
      studentId: string;
      taskId: string;
      sortOrder: number;
      puzzleCreatedAt: Date;
      cyclePracticeLimit: number | null;
      studyHours: number;
    },
    now: Date,
  ): Promise<{ id: string; name: string } | null> {
    const db = this.db!;

    const taskPuzzles = await db
      .select({
        id: puzzles.id,
        name: puzzles.name,
        sortOrder: puzzles.sortOrder,
        createdAt: puzzles.createdAt,
        assignmentId: puzzleAssignments.id,
        assignmentMode: puzzleAssignments.mode,
        assignmentDueAt: puzzleAssignments.dueAt,
        assignmentCompletedAt: puzzleAssignments.completedAt,
      })
      .from(puzzles)
      .leftJoin(
        puzzleAssignments,
        and(
          eq(puzzleAssignments.puzzleId, puzzles.id),
          eq(puzzleAssignments.studentId, a.studentId),
        ),
      )
      .where(eq(puzzles.taskId, a.taskId))
      .orderBy(asc(puzzles.sortOrder), asc(puzzles.createdAt));

    // Look forward first, then wrap to the start — the teacher may have started the student
    // somewhere in the middle of the task, and the cycle must cover every variant of it.
    const currentIdx = taskPuzzles.findIndex((p) => p.id === a.puzzleId);
    const ordered =
      currentIdx >= 0
        ? [...taskPuzzles.slice(currentIdx + 1), ...taskPuzzles.slice(0, currentIdx)]
        : taskPuzzles;
    const next = ordered.find((p) => p.id !== a.puzzleId && !p.assignmentCompletedAt);
    if (!next) return null;

    const dueAt = new Date(now.getTime() + a.studyHours * 3600 * 1000);

    if (!next.assignmentId) {
      await db
        .insert(puzzleAssignments)
        .values({
          puzzleId: next.id,
          teacherId: a.teacherId,
          studentId: a.studentId,
          mode: "new",
          practiceLimit: null,
          practiceAttemptsUsed: 0,
          practiceSuccessCount: 0,
          practiceFailureProgressSum: 0,
          studyHours: a.studyHours,
          cyclePracticeLimit: a.cyclePracticeLimit,
          dueAt,
          assignedAt: now,
        })
        .onConflictDoNothing();
    } else if (next.assignmentMode === "new" && next.assignmentDueAt) {
      // Already an active o'rganish round — leave the student's running deadline alone.
    } else if (next.assignmentMode === "new") {
      await db
        .update(puzzleAssignments)
        .set({ studyHours: a.studyHours, cyclePracticeLimit: a.cyclePracticeLimit, dueAt })
        .where(eq(puzzleAssignments.id, next.assignmentId));
    } else {
      // Mid-mashq on that variant already: keep its round, only carry the cycle settings over.
      await db
        .update(puzzleAssignments)
        .set({ studyHours: a.studyHours, cyclePracticeLimit: a.cyclePracticeLimit })
        .where(eq(puzzleAssignments.id, next.assignmentId));
    }

    return { id: next.id, name: next.name };
  }

  /** At least one wrong attempt in the round: back to o'rganish with a fresh deadline. */
  private async revertAssignmentToStudy(a: {
    id: string;
    studentId: string;
    puzzleName: string;
    studentTelegramId: string | null;
    practiceSuccessCount: number;
    studyHours: number;
    limit: number;
  }): Promise<PuzzleCycleOutcome> {
    const db = this.db!;
    const now = new Date();
    const dueAt = new Date(now.getTime() + a.studyHours * 3600 * 1000);

    // Only the attempt that actually closes the mashq round reverts it; a concurrent duplicate
    // finds the assignment already back in o'rganish and does nothing.
    const reverted = await db
      .update(puzzleAssignments)
      .set({
        mode: "new",
        practiceLimit: null,
        practiceAttemptsUsed: 0,
        practiceSuccessCount: 0,
        practiceFailureProgressSum: 0,
        dueAt,
        assignedAt: now,
        completedAt: null,
      })
      .where(and(eq(puzzleAssignments.id, a.id), eq(puzzleAssignments.mode, "test")))
      .returning({ id: puzzleAssignments.id });
    if (reverted.length === 0) return { status: "in_progress" };

    const correct = a.practiceSuccessCount ?? 0;
    this.logger.log(
      `Assignment ${a.id} failed the round (${correct}/${a.limit}); reverted to study mode until ${dueAt.toISOString()}.`,
    );

    this.notifyStudent({
      telegramId: a.studentTelegramId,
      studentId: a.studentId,
      context: "puzzleCycle.revert",
      message:
        `📘 Mashq yakunlandi — o'rganishga qaytdingiz\n\n` +
        `Nomi: ${a.puzzleName}\n` +
        `Natija: ${correct}/${a.limit} ta urinish to'g'ri\n` +
        `⏰ O'rganish muddati: ${a.studyHours} soat\n\n` +
        `Yurishlarni yana o'rganing — muddat tugagach mashq qaytadan boshlanadi.`,
      spokenText:
        `Mashq yakunlandi. ${a.puzzleName} variantida ${a.limit} ta urinishdan ${correct} tasi to'g'ri bo'ldi. ` +
        `Shuning uchun o'rganish rejimiga qaytdingiz. O'rganish muddati ${a.studyHours} soat. ` +
        `Yurishlarni yana o'rganing, muddat tugagach mashq qaytadan boshlanadi.`,
    });

    return { status: "reverted", dueAt, studyHours: a.studyHours };
  }
}
