import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { asc, desc, eq } from "drizzle-orm";
import type { DrizzleDb } from "../db";
import {
  courses,
  debutLevels,
  modules,
  puzzleAssignments,
  puzzles,
  tasks,
  users,
} from "../db/schema";
import { DRIZZLE_DB } from "../db/tokens";

export type PracticePuzzleStatRow = {
  assignmentId: string;
  studentId: string;
  studentLogin: string;
  puzzleId: string;
  puzzleName: string;
  taskId: string;
  taskName: string;
  moduleId: string;
  moduleName: string;
  courseId: string;
  courseName: string;
  levelId: string;
  levelName: string;
  practiceLimit: number | null;
  /** Jami sarflangan urinishlar (muvaffaqiyat + xato). */
  practiceAttemptsUsed: number;
  /** To'liq chiziq muvaffaqiyatli yakunlangan urinishlar. */
  practiceSuccessCount: number;
  /** Xato urinishlar (attemptsUsed - success). */
  practiceFailCount: number;
  /** Xato paytida progress foizlari yig‘indisi (har xato 0–100). */
  practiceFailureProgressSum: number;
  /** Xato urinishlar bo‘yicha o‘rtacha progress foizi (qayerda xato qilgan). */
  averageFailProgressPercent: number | null;
  /** Limit bo'lsa: qolgan urinishlar; cheksiz bo'lsa null. */
  practiceLeft: number | null;
  assignedAt: string;
  completedAt: string | null;
};

export type LearningPuzzleStatRow = {
  assignmentId: string;
  studentId: string;
  studentLogin: string;
  puzzleId: string;
  puzzleName: string;
  taskId: string;
  taskName: string;
  moduleId: string;
  moduleName: string;
  courseId: string;
  courseName: string;
  levelId: string;
  levelName: string;
  learningSecondsTotal: number;
  assignedAt: string;
  completedAt: string | null;
};

@Injectable()
export class AdminStatsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null) {}

  private getDb(): DrizzleDb {
    if (!this.db) throw new ServiceUnavailableException("Database is not configured");
    return this.db;
  }

  /**
   * O'rganish rejimidagi tayinlovlar: variant bo'yicha jami o'rganish vaqti (soniya).
   * Kelajakda boshqa statistikalar ham shu modulga qo'shiladi.
   */
  async listLearningPuzzleStats(): Promise<LearningPuzzleStatRow[]> {
    const db = this.getDb();
    const rows = await db
      .select({
        assignmentId: puzzleAssignments.id,
        studentId: puzzleAssignments.studentId,
        studentLogin: users.login,
        puzzleId: puzzles.id,
        puzzleName: puzzles.name,
        taskId: tasks.id,
        taskName: tasks.name,
        moduleId: modules.id,
        moduleName: modules.name,
        courseId: courses.id,
        courseName: courses.name,
        levelId: debutLevels.id,
        levelName: debutLevels.name,
        learningSecondsTotal: puzzleAssignments.learningSecondsTotal,
        assignedAt: puzzleAssignments.assignedAt,
        completedAt: puzzleAssignments.completedAt,
      })
      .from(puzzleAssignments)
      .innerJoin(puzzles, eq(puzzles.id, puzzleAssignments.puzzleId))
      .innerJoin(tasks, eq(tasks.id, puzzles.taskId))
      .innerJoin(modules, eq(modules.id, tasks.moduleId))
      .innerJoin(courses, eq(courses.id, modules.courseId))
      .innerJoin(debutLevels, eq(debutLevels.id, courses.debutLevelId))
      .innerJoin(users, eq(users.id, puzzleAssignments.studentId))
      .where(eq(puzzleAssignments.mode, "new"))
      .orderBy(desc(puzzleAssignments.learningSecondsTotal), asc(users.login));

    return rows.map((r) => ({
      assignmentId: r.assignmentId,
      studentId: r.studentId,
      studentLogin: r.studentLogin,
      puzzleId: r.puzzleId,
      puzzleName: r.puzzleName,
      taskId: r.taskId,
      taskName: r.taskName,
      moduleId: r.moduleId,
      moduleName: r.moduleName,
      courseId: r.courseId,
      courseName: r.courseName,
      levelId: r.levelId,
      levelName: r.levelName,
      learningSecondsTotal: r.learningSecondsTotal ?? 0,
      assignedAt: r.assignedAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    }));
  }

  /** Mashq (test) tayinlovlari: urinishlar, muvaffaqiyat, xato, qoldi. */
  async listPracticePuzzleStats(): Promise<PracticePuzzleStatRow[]> {
    const db = this.getDb();
    const rows = await db
      .select({
        assignmentId: puzzleAssignments.id,
        studentId: puzzleAssignments.studentId,
        studentLogin: users.login,
        puzzleId: puzzles.id,
        puzzleName: puzzles.name,
        taskId: tasks.id,
        taskName: tasks.name,
        moduleId: modules.id,
        moduleName: modules.name,
        courseId: courses.id,
        courseName: courses.name,
        levelId: debutLevels.id,
        levelName: debutLevels.name,
        practiceLimit: puzzleAssignments.practiceLimit,
        practiceAttemptsUsed: puzzleAssignments.practiceAttemptsUsed,
        practiceSuccessCount: puzzleAssignments.practiceSuccessCount,
        practiceFailureProgressSum: puzzleAssignments.practiceFailureProgressSum,
        assignedAt: puzzleAssignments.assignedAt,
        completedAt: puzzleAssignments.completedAt,
      })
      .from(puzzleAssignments)
      .innerJoin(puzzles, eq(puzzles.id, puzzleAssignments.puzzleId))
      .innerJoin(tasks, eq(tasks.id, puzzles.taskId))
      .innerJoin(modules, eq(modules.id, tasks.moduleId))
      .innerJoin(courses, eq(courses.id, modules.courseId))
      .innerJoin(debutLevels, eq(debutLevels.id, courses.debutLevelId))
      .innerJoin(users, eq(users.id, puzzleAssignments.studentId))
      .where(eq(puzzleAssignments.mode, "test"))
      .orderBy(desc(puzzleAssignments.practiceAttemptsUsed), asc(users.login));

    return rows.map((r) => {
      const used = r.practiceAttemptsUsed ?? 0;
      const success = r.practiceSuccessCount ?? 0;
      const fail = Math.max(0, used - success);
      const sumFailProgress = r.practiceFailureProgressSum ?? 0;
      const averageFailProgressPercent =
        fail > 0 ? Math.round(sumFailProgress / fail) : null;
      const limit = r.practiceLimit;
      const left = limit !== null ? Math.max(0, limit - used) : null;
      return {
        assignmentId: r.assignmentId,
        studentId: r.studentId,
        studentLogin: r.studentLogin,
        puzzleId: r.puzzleId,
        puzzleName: r.puzzleName,
        taskId: r.taskId,
        taskName: r.taskName,
        moduleId: r.moduleId,
        moduleName: r.moduleName,
        courseId: r.courseId,
        courseName: r.courseName,
        levelId: r.levelId,
        levelName: r.levelName,
        practiceLimit: limit,
        practiceAttemptsUsed: used,
        practiceSuccessCount: success,
        practiceFailCount: fail,
        practiceFailureProgressSum: sumFailProgress,
        averageFailProgressPercent,
        practiceLeft: left,
        assignedAt: r.assignedAt.toISOString(),
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      };
    });
  }
}
