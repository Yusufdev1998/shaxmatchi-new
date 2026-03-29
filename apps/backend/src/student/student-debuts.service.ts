import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  ForbiddenException,
} from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DrizzleDb } from "../db";
import {
  courses,
  debutLevels,
  modules,
  puzzleAssignments,
  puzzles,
  tasks,
} from "../db/schema";
import { DRIZZLE_DB } from "../db/tokens";

@Injectable()
export class StudentDebutsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null) {}

  private getDb(): DrizzleDb {
    if (!this.db) throw new ServiceUnavailableException("Database is not configured");
    return this.db;
  }

  /** Levels that contain at least one puzzle assigned to this student. */
  async listLevels(studentId: string) {
    const db = this.getDb();
    const sub = await db
      .select({ levelId: courses.debutLevelId })
      .from(puzzleAssignments)
      .innerJoin(puzzles, eq(puzzles.id, puzzleAssignments.puzzleId))
      .innerJoin(tasks, eq(tasks.id, puzzles.taskId))
      .innerJoin(modules, eq(modules.id, tasks.moduleId))
      .innerJoin(courses, eq(courses.id, modules.courseId))
      .where(eq(puzzleAssignments.studentId, studentId));

    const ids = [...new Set(sub.map((r) => r.levelId))];
    if (ids.length === 0) return [];
    return db
      .select()
      .from(debutLevels)
      .where(inArray(debutLevels.id, ids))
      .orderBy(asc(debutLevels.createdAt));
  }

  async getLevel(levelId: string) {
    const rows = await this.getDb().select().from(debutLevels).where(eq(debutLevels.id, levelId)).limit(1);
    const row = rows[0];
    if (!row) throw new NotFoundException("Debut level not found");
    return row;
  }

  /** Courses under this level that contain at least one puzzle assigned to the student. */
  async listCourses(levelId: string, studentId: string) {
    const db = this.getDb();
    await this.getLevel(levelId);

    const sub = await db
      .select({ courseId: courses.id })
      .from(puzzleAssignments)
      .innerJoin(puzzles, eq(puzzles.id, puzzleAssignments.puzzleId))
      .innerJoin(tasks, eq(tasks.id, puzzles.taskId))
      .innerJoin(modules, eq(modules.id, tasks.moduleId))
      .innerJoin(courses, eq(courses.id, modules.courseId))
      .where(and(eq(puzzleAssignments.studentId, studentId), eq(courses.debutLevelId, levelId)));

    const ids = [...new Set(sub.map((r) => r.courseId))];
    if (ids.length === 0) return [];
    return db
      .select()
      .from(courses)
      .where(inArray(courses.id, ids))
      .orderBy(asc(courses.createdAt));
  }

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

  /** Modules in this course that contain at least one puzzle assigned to the student. */
  async listModules(levelId: string, courseId: string, studentId: string) {
    const db = this.getDb();
    await this.getCourse(levelId, courseId);

    const sub = await db
      .select({ moduleId: modules.id })
      .from(puzzleAssignments)
      .innerJoin(puzzles, eq(puzzles.id, puzzleAssignments.puzzleId))
      .innerJoin(tasks, eq(tasks.id, puzzles.taskId))
      .innerJoin(modules, eq(modules.id, tasks.moduleId))
      .innerJoin(courses, eq(courses.id, modules.courseId))
      .where(
        and(
          eq(puzzleAssignments.studentId, studentId),
          eq(courses.debutLevelId, levelId),
          eq(courses.id, courseId),
        ),
      );

    const ids = [...new Set(sub.map((r) => r.moduleId))];
    if (ids.length === 0) return [];
    return db
      .select()
      .from(modules)
      .where(inArray(modules.id, ids))
      .orderBy(asc(modules.createdAt));
  }

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

  /** Tasks in this module that contain at least one puzzle assigned to the student. */
  async listTasks(levelId: string, courseId: string, moduleId: string, studentId: string) {
    const db = this.getDb();
    await this.getModule(levelId, courseId, moduleId);

    const sub = await db
      .select({ taskId: tasks.id })
      .from(puzzleAssignments)
      .innerJoin(puzzles, eq(puzzles.id, puzzleAssignments.puzzleId))
      .innerJoin(tasks, eq(tasks.id, puzzles.taskId))
      .innerJoin(modules, eq(modules.id, tasks.moduleId))
      .innerJoin(courses, eq(courses.id, modules.courseId))
      .where(
        and(
          eq(puzzleAssignments.studentId, studentId),
          eq(courses.debutLevelId, levelId),
          eq(courses.id, courseId),
          eq(modules.id, moduleId),
        ),
      );

    const ids = [...new Set(sub.map((r) => r.taskId))];
    if (ids.length === 0) return [];
    return db
      .select()
      .from(tasks)
      .where(inArray(tasks.id, ids))
      .orderBy(asc(tasks.createdAt));
  }

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

  /** Puzzles in this task that are assigned to the student (only those). */
  async listPuzzlesForStudent(input: {
    levelId: string;
    courseId: string;
    moduleId: string;
    taskId: string;
    studentId: string;
  }) {
    const db = this.getDb();
    await this.getTask(input.levelId, input.courseId, input.moduleId, input.taskId);

    const rows = await db
      .select({
        id: puzzles.id,
        taskId: puzzles.taskId,
        name: puzzles.name,
        createdAt: puzzles.createdAt,
        assignmentId: puzzleAssignments.id,
        mode: puzzleAssignments.mode,
        assignedAt: puzzleAssignments.assignedAt,
        completedAt: puzzleAssignments.completedAt,
      })
      .from(puzzles)
      .innerJoin(
        puzzleAssignments,
        and(
          eq(puzzleAssignments.puzzleId, puzzles.id),
          eq(puzzleAssignments.studentId, input.studentId),
        ),
      )
      .where(eq(puzzles.taskId, input.taskId))
      .orderBy(asc(puzzles.createdAt));

    return rows.map((r) => ({
      id: r.id,
      taskId: r.taskId,
      name: r.name,
      createdAt: r.createdAt,
      locked: false as const,
      assignment: {
        id: r.assignmentId,
        mode: r.mode!,
        assignedAt: r.assignedAt!,
        completedAt: r.completedAt ?? null,
      },
    }));
  }

  async getPuzzleForStudent(input: { puzzleId: string; studentId: string }) {
    const db = this.getDb();

    const a = await db
      .select({
        assignmentId: puzzleAssignments.id,
        mode: puzzleAssignments.mode,
      })
      .from(puzzleAssignments)
      .where(and(eq(puzzleAssignments.puzzleId, input.puzzleId), eq(puzzleAssignments.studentId, input.studentId)))
      .limit(1);
    const assignment = a[0];
    if (!assignment) throw new ForbiddenException("Puzzle is locked");

    const rows = await db.select().from(puzzles).where(eq(puzzles.id, input.puzzleId)).limit(1);
    const puzzle = rows[0];
    if (!puzzle) throw new NotFoundException("Puzzle not found");

    return {
      id: puzzle.id,
      taskId: puzzle.taskId,
      name: puzzle.name,
      moves: puzzle.moves,
      createdAt: puzzle.createdAt,
      mode: assignment.mode,
    };
  }
}
