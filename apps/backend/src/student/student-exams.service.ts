import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { and, desc, eq, inArray, isNotNull, lt, ne, sql } from "drizzle-orm";
import type { DrizzleDb } from "../db";
import {
  examAssignments,
  examAttempts,
  examTasks,
  exams,
  puzzles,
  type ExamAttemptFailDetail,
  type ExamAttemptProgress,
} from "../db/schema";
import { DRIZZLE_DB } from "../db/tokens";

/**
 * Seconds of silence (no heartbeat) after which an in_progress attempt is considered
 * abandoned and failed on the next list/get. Measured from `last_seen_at`, which the
 * student app bumps every 30s while the exam is open — so this means "the student is
 * gone", never "the exam is taking a while".
 */
const ABANDON_GRACE_SECONDS = 10 * 60;

/**
 * How long after an attempt was failed as abandoned a late verdict from the student app
 * (finished offline, delivered once back online) may still replace it.
 */
const LATE_RESULT_SECONDS = 24 * 60 * 60;

@Injectable()
export class StudentExamsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null) {}

  private getDb(): DrizzleDb {
    if (!this.db) throw new ServiceUnavailableException("Database is not configured");
    return this.db;
  }

  /** Marks any `in_progress` attempts whose last heartbeat is older than the grace window as `failed`. */
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
          lt(examAttempts.lastSeenAt, cutoff),
        ),
      );
    if (abandoned.length === 0) return;
    // Conditional on still being in_progress, and billing only what this update really
    // flipped: a verdict that lands between the select and the update must not be
    // failed (or billed) a second time.
    const now = new Date();
    const flipped = await db
      .update(examAttempts)
      .set({ status: "failed", completedAt: now, abandonedAt: now })
      .where(
        and(
          inArray(examAttempts.id, abandoned.map((r) => r.id)),
          eq(examAttempts.status, "in_progress"),
        ),
      )
      .returning({ assignmentId: examAttempts.assignmentId });
    const countsByAssignment = new Map<string, number>();
    for (const r of flipped) {
      countsByAssignment.set(r.assignmentId, (countsByAssignment.get(r.assignmentId) ?? 0) + 1);
    }
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
        cooldownSeconds: exams.cooldownSeconds,
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
        cooldownSeconds: exams.cooldownSeconds,
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
        cooldownSeconds: exams.cooldownSeconds,
      })
      .from(examAssignments)
      .innerJoin(exams, eq(exams.id, examAssignments.examId))
      .where(and(eq(examAssignments.studentId, studentId), eq(examAssignments.examId, examId)))
      .limit(1);
    const assignment = assignRows[0];
    if (!assignment) throw new NotFoundException("Exam not assigned to this student");

    // A live attempt is resumed, never burned: the app may have been killed, reloaded or
    // lost its connection, and tapping "start" again must not cost the student a try.
    // Only attempts that have gone silent for the whole grace window are given up on.
    const openAttempts = await db
      .select({ id: examAttempts.id, lastSeenAt: examAttempts.lastSeenAt })
      .from(examAttempts)
      .where(
        and(
          eq(examAttempts.assignmentId, assignment.id),
          eq(examAttempts.status, "in_progress"),
        ),
      )
      .orderBy(desc(examAttempts.startedAt));
    const liveCutoff = Date.now() - ABANDON_GRACE_SECONDS * 1000;
    const live = openAttempts.find((a) => a.lastSeenAt.getTime() >= liveCutoff);
    if (live) return this.getAttempt(live.id, studentId);

    if (assignment.attemptsUsed >= assignment.attemptsAllowed) {
      throw new ForbiddenException("Urinishlar tugagan");
    }

    // Cooldown: enforce a wait after the most recently finished attempt (pass or fail).
    if (assignment.cooldownSeconds > 0) {
      const lastFinished = await db
        .select({ completedAt: examAttempts.completedAt })
        .from(examAttempts)
        .where(
          and(
            eq(examAttempts.assignmentId, assignment.id),
            ne(examAttempts.status, "in_progress"),
          ),
        )
        .orderBy(desc(examAttempts.completedAt))
        .limit(1);
      const completedAt = lastFinished[0]?.completedAt;
      if (completedAt) {
        const elapsedSeconds = Math.floor((Date.now() - completedAt.getTime()) / 1000);
        const remaining = assignment.cooldownSeconds - elapsedSeconds;
        if (remaining > 0) {
          throw new ForbiddenException(`Keyingi urinishgacha ${remaining} soniya kuting`);
        }
      }
    }

    // Whatever is still open here has been silent past the grace window: fail and bill it.
    if (openAttempts.length > 0) {
      const now = new Date();
      const flipped = await db
        .update(examAttempts)
        .set({ status: "failed", completedAt: now, abandonedAt: now })
        .where(
          and(
            inArray(
              examAttempts.id,
              openAttempts.map((r) => r.id),
            ),
            eq(examAttempts.status, "in_progress"),
          ),
        )
        .returning({ id: examAttempts.id });
      const nextUsed = assignment.attemptsUsed + flipped.length;
      await db
        .update(examAssignments)
        .set({ attemptsUsed: sql`${examAssignments.attemptsUsed} + ${flipped.length}` })
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
      cooldownSeconds: assignment.cooldownSeconds,
      attemptsLeft: assignment.attemptsAllowed - assignment.attemptsUsed - 1,
      progress: null,
      puzzles: picked.map((p) => ({
        id: p.id,
        name: p.name,
        moves: p.moves,
        studentSide: p.studentSide,
      })),
    };
  }

  /**
   * Resume an in-progress attempt: returns the same payload as `startAttempt`, rebuilt
   * from the puzzle ids frozen on the attempt row. Lets the student app survive a reload,
   * a PWA update or an eviction by the mobile OS without burning the attempt.
   */
  async getAttempt(attemptId: string, studentId: string) {
    const db = this.getDb();
    const rows = await db
      .select({
        id: examAttempts.id,
        status: examAttempts.status,
        puzzleIds: examAttempts.puzzleIds,
        progress: examAttempts.progress,
        studentId: examAssignments.studentId,
        attemptsUsed: examAssignments.attemptsUsed,
        attemptsAllowed: exams.attemptsAllowed,
        secondsPerMove: exams.secondsPerMove,
        cooldownSeconds: exams.cooldownSeconds,
      })
      .from(examAttempts)
      .innerJoin(examAssignments, eq(examAssignments.id, examAttempts.assignmentId))
      .innerJoin(exams, eq(exams.id, examAssignments.examId))
      .where(eq(examAttempts.id, attemptId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException("Attempt not found");
    if (row.studentId !== studentId) throw new ForbiddenException("Not your attempt");
    if (row.status !== "in_progress") {
      throw new ConflictException("Bu urinish allaqachon yakunlangan");
    }

    // Reading the attempt is a sign of life — keep the sweeper off it.
    await this.touchAttempt(attemptId, studentId);

    const ids = row.puzzleIds;
    const found = ids.length
      ? await db.select().from(puzzles).where(inArray(puzzles.id, ids))
      : [];
    const byId = new Map(found.map((p) => [p.id, p]));
    // Preserve the frozen order; silently drop puzzles deleted since the attempt started.
    const ordered = ids.map((id) => byId.get(id)).filter((p) => p !== undefined);
    if (ordered.length === 0) {
      throw new BadRequestException("Imtihonda pazllar yo'q");
    }

    return {
      attemptId: row.id,
      secondsPerMove: row.secondsPerMove,
      cooldownSeconds: row.cooldownSeconds,
      attemptsLeft: Math.max(0, row.attemptsAllowed - row.attemptsUsed - 1),
      progress: row.progress ?? null,
      puzzles: ordered.map((p) => ({
        id: p.id,
        name: p.name,
        moves: p.moves,
        studentSide: p.studentSide,
      })),
    };
  }

  /**
   * Heartbeat: the student app is still on this attempt. A no-op once the attempt is
   * finalized, so a late beat can never resurrect a finished attempt.
   */
  async touchAttempt(attemptId: string, studentId: string, progress?: ExamAttemptProgress) {
    const db = this.getDb();
    const rows = await db
      .select({ studentId: examAssignments.studentId, saved: examAttempts.progress })
      .from(examAttempts)
      .innerJoin(examAssignments, eq(examAssignments.id, examAttempts.assignmentId))
      .where(eq(examAttempts.id, attemptId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException("Attempt not found");
    if (row.studentId !== studentId) throw new ForbiddenException("Not your attempt");

    // Progress only ever moves forward: a delayed beat from a slow connection must not
    // overwrite what a newer one already stored.
    const saved = row.saved;
    const advances =
      !!progress &&
      (!saved ||
        progress.puzzleIdx > saved.puzzleIdx ||
        (progress.puzzleIdx === saved.puzzleIdx && progress.moveIdx >= saved.moveIdx));

    await db
      .update(examAttempts)
      .set({ lastSeenAt: new Date(), ...(advances ? { progress } : {}) })
      .where(and(eq(examAttempts.id, attemptId), eq(examAttempts.status, "in_progress")));
    return { ok: true as const };
  }

  /**
   * Finalize the attempt. Safe to call repeatedly and concurrently (the app retries):
   * exactly one call flips the row and bills the attempt. A verdict arriving for an attempt
   * the server already gave up on (abandoned) replaces it within `LATE_RESULT_SECONDS` —
   * the attempt was billed when it was swept, so it is not billed again.
   */
  async finalizeAttempt(input: {
    attemptId: string;
    studentId: string;
    result: "passed" | "failed";
    /** Every mistake made during the attempt, in order. Empty/undefined for a clean pass. */
    failDetails?: ExamAttemptFailDetail[];
  }) {
    const db = this.getDb();
    const rows = await db
      .select({
        status: examAttempts.status,
        abandonedAt: examAttempts.abandonedAt,
        assignmentId: examAttempts.assignmentId,
        studentId: examAssignments.studentId,
      })
      .from(examAttempts)
      .innerJoin(examAssignments, eq(examAssignments.id, examAttempts.assignmentId))
      .where(eq(examAttempts.id, input.attemptId))
      .limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException("Attempt not found");
    if (row.studentId !== input.studentId) throw new ForbiddenException("Not your attempt");

    const fails = input.result === "failed" ? (input.failDetails ?? []) : [];
    const verdict = {
      status: input.result,
      completedAt: new Date(),
      // `failDetail` keeps the first mistake for backward compatibility; `failDetails` holds all.
      failDetail: fails[0] ?? null,
      failDetails: fails.length > 0 ? fails : null,
      abandonedAt: null,
    };

    // Normal path: claim the in-progress row. The status guard makes this atomic, so a
    // duplicate or racing retry updates nothing and bills nothing.
    const claimed = await db.transaction(async (tx) => {
      const updated = await tx
        .update(examAttempts)
        .set(verdict)
        .where(and(eq(examAttempts.id, input.attemptId), eq(examAttempts.status, "in_progress")))
        .returning({ id: examAttempts.id });
      if (updated.length === 0) return false;
      await tx
        .update(examAssignments)
        .set({ attemptsUsed: sql`${examAssignments.attemptsUsed} + 1` })
        .where(eq(examAssignments.id, row.assignmentId));
      return true;
    });
    if (claimed) return { ok: true as const, status: input.result };

    // Late verdict for an attempt the sweeper already failed: let the real result stand.
    if (row.abandonedAt && Date.now() - row.abandonedAt.getTime() <= LATE_RESULT_SECONDS * 1000) {
      const replaced = await db
        .update(examAttempts)
        .set(verdict)
        .where(and(eq(examAttempts.id, input.attemptId), isNotNull(examAttempts.abandonedAt)))
        .returning({ id: examAttempts.id });
      if (replaced.length > 0) return { ok: true as const, status: input.result };
    }

    // Already finalized: idempotent, report the current state.
    const [current] = await db
      .select({ status: examAttempts.status })
      .from(examAttempts)
      .where(eq(examAttempts.id, input.attemptId))
      .limit(1);
    return { ok: true as const, status: current?.status ?? row.status };
  }
}
