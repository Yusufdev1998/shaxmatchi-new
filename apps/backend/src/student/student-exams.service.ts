import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { DrizzleDb } from "../db";
import {
  examAssignments,
  examAttempts,
  examTasks,
  exams,
  puzzles,
} from "../db/schema";
import { DRIZZLE_DB } from "../db/tokens";

/** Seconds after which an abandoned in_progress attempt is considered failed on next list/start. */
const ABANDON_GRACE_SECONDS = 10 * 60;

@Injectable()
export class StudentExamsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null) {}

  private getDb(): DrizzleDb {
    if (!this.db) throw new ServiceUnavailableException("Database is not configured");
    return this.db;
  }

  /** Marks any `in_progress` attempts whose `started_at` is older than the grace window as `failed`. */
  private async sweepAbandonedAttemptsForStudent(studentId: string) {
    const db = this.getDb();
    const cutoff = new Date(Date.now() - ABANDON_GRACE_SECONDS * 1000);
    const abandoned = await db
      .select({
        id: examAttempts.id,
        assignmentId: examAttempts.assignmentId,
      })
      .from(examAttempts)
      .innerJoin(examAssignments, eq(examAssignments.id, examAttempts.assignmentId))
      .where(
        and(
          eq(examAssignments.studentId, studentId),
          eq(examAttempts.status, "in_progress"),
          lt(examAttempts.startedAt, cutoff),
        ),
      );
    if (abandoned.length === 0) return;
    const countsByAssignment = new Map<string, number>();
    for (const r of abandoned) {
      countsByAssignment.set(r.assignmentId, (countsByAssignment.get(r.assignmentId) ?? 0) + 1);
    }
    await db
      .update(examAttempts)
      .set({ status: "failed", completedAt: new Date() })
      .where(inArray(examAttempts.id, abandoned.map((r) => r.id)));
    for (const [assignmentId, delta] of countsByAssignment) {
      await db
        .update(examAssignments)
        .set({ attemptsUsed: sql`${examAssignments.attemptsUsed} + ${delta}` })
        .where(eq(examAssignments.id, assignmentId));
    }
  }

  async listForStudent(studentId: string) {
    await this.sweepAbandonedAttemptsForStudent(studentId);
    const db = this.getDb();
    const rows = await db
      .select({
        assignmentId: examAssignments.id,
        examId: exams.id,
        name: exams.name,
        secondsPerMove: exams.secondsPerMove,
        attemptsAllowed: exams.attemptsAllowed,
        puzzleCount: exams.puzzleCount,
        attemptsUsed: examAssignments.attemptsUsed,
        assignedAt: examAssignments.assignedAt,
      })
      .from(examAssignments)
      .innerJoin(exams, eq(exams.id, examAssignments.examId))
      .where(eq(examAssignments.studentId, studentId))
      .orderBy(desc(examAssignments.assignedAt));
    return rows;
  }

  async getForStudent(examId: string, studentId: string) {
    await this.sweepAbandonedAttemptsForStudent(studentId);
    const db = this.getDb();
    const rows = await db
      .select({
        assignmentId: examAssignments.id,
        examId: exams.id,
        name: exams.name,
        secondsPerMove: exams.secondsPerMove,
        attemptsAllowed: exams.attemptsAllowed,
        puzzleCount: exams.puzzleCount,
        attemptsUsed: examAssignments.attemptsUsed,
        assignedAt: examAssignments.assignedAt,
      })
      .from(examAssignments)
      .innerJoin(exams, eq(exams.id, examAssignments.examId))
      .where(and(eq(examAssignments.studentId, studentId), eq(examAssignments.examId, examId)))
      .limit(1);
    const exam = rows[0];
    if (!exam) throw new NotFoundException("Exam not assigned to this student");

    const attempts = await db
      .select({
        id: examAttempts.id,
        status: examAttempts.status,
        startedAt: examAttempts.startedAt,
        completedAt: examAttempts.completedAt,
      })
      .from(examAttempts)
      .where(eq(examAttempts.assignmentId, exam.assignmentId))
      .orderBy(desc(examAttempts.startedAt));

    return { ...exam, attempts };
  }

  /**
   * Start a new attempt: picks a random subset of puzzles from the exam's tasks and
   * freezes the selection on the `exam_attempts` row. Returns full puzzle data for play.
   */
  async startAttempt(examId: string, studentId: string) {
    const db = this.getDb();
    const assignRows = await db
      .select({
        id: examAssignments.id,
        attemptsUsed: examAssignments.attemptsUsed,
        attemptsAllowed: exams.attemptsAllowed,
        secondsPerMove: exams.secondsPerMove,
        puzzleCount: exams.puzzleCount,
      })
      .from(examAssignments)
      .innerJoin(exams, eq(exams.id, examAssignments.examId))
      .where(and(eq(examAssignments.studentId, studentId), eq(examAssignments.examId, examId)))
      .limit(1);
    const assignment = assignRows[0];
    if (!assignment) throw new NotFoundException("Exam not assigned to this student");
    if (assignment.attemptsUsed >= assignment.attemptsAllowed) {
      throw new ForbiddenException("Urinishlar tugagan");
    }

    // Fail any earlier still-open attempts and bill them.
    const stillOpen = await db
      .select({ id: examAttempts.id })
      .from(examAttempts)
      .where(
        and(
          eq(examAttempts.assignmentId, assignment.id),
          eq(examAttempts.status, "in_progress"),
        ),
      );
    if (stillOpen.length > 0) {
      await db
        .update(examAttempts)
        .set({ status: "failed", completedAt: new Date() })
        .where(
          inArray(
            examAttempts.id,
            stillOpen.map((r) => r.id),
          ),
        );
      const nextUsed = assignment.attemptsUsed + stillOpen.length;
      await db
        .update(examAssignments)
        .set({ attemptsUsed: nextUsed })
        .where(eq(examAssignments.id, assignment.id));
      if (nextUsed >= assignment.attemptsAllowed) {
        throw new ForbiddenException("Urinishlar tugagan");
      }
      assignment.attemptsUsed = nextUsed;
    }

    // Pool: all puzzles in all tasks attached to this exam.
    const taskRows = await db
      .select({ taskId: examTasks.taskId })
      .from(examTasks)
      .where(eq(examTasks.examId, examId));
    if (taskRows.length === 0) {
      throw new BadRequestException("Imtihon vazifalari topilmadi");
    }
    const pool = await db
      .select()
      .from(puzzles)
      .where(inArray(puzzles.taskId, taskRows.map((r) => r.taskId)));
    if (pool.length === 0) {
      throw new BadRequestException("Imtihonda pazllar yo'q");
    }

    // Random sample (up to puzzleCount). Fisher-Yates shuffle, then slice.
    const shuffled = pool.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    const picked = shuffled.slice(0, Math.min(assignment.puzzleCount, shuffled.length));
    const pickedIds = picked.map((p) => p.id);

    const [attempt] = await db
      .insert(examAttempts)
      .values({
        assignmentId: assignment.id,
        puzzleIds: pickedIds,
      })
      .returning();
    if (!attempt) throw new ServiceUnavailableException("Failed to start attempt");

    return {
      attemptId: attempt.id,
      secondsPerMove: assignment.secondsPerMove,
      attemptsLeft: assignment.attemptsAllowed - assignment.attemptsUsed - 1,
      puzzles: picked.map((p) => ({
        id: p.id,
        name: p.name,
        moves: p.moves,
        studentSide: p.studentSide,
      })),
    };
  }

  /** Finalize the attempt. Increments assignment.attemptsUsed on the first finalize. */
  async finalizeAttempt(input: {
    attemptId: string;
    studentId: string;
    result: "passed" | "failed";
  }) {
    const db = this.getDb();
    const rows = await db
      .select({
        attemptId: examAttempts.id,
        status: examAttempts.status,
        assignmentId: examAttempts.assignmentId,
        studentId: examAssignments.studentId,
        attemptsUsed: examAssignments.attemptsUsed,
      })
      .from(examAttempts)
      .innerJoin(examAssignments, eq(examAssignments.id, examAttempts.assignmentId))
      .where(eq(examAttempts.id, input.attemptId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException("Attempt not found");
    if (row.studentId !== input.studentId) throw new ForbiddenException("Not your attempt");
    if (row.status !== "in_progress") {
      // idempotent: just return current state
      return { ok: true as const, status: row.status };
    }

    await db
      .update(examAttempts)
      .set({ status: input.result, completedAt: new Date() })
      .where(eq(examAttempts.id, input.attemptId));
    await db
      .update(examAssignments)
      .set({ attemptsUsed: row.attemptsUsed + 1 })
      .where(eq(examAssignments.id, row.assignmentId));

    return { ok: true as const, status: input.result };
  }
}
