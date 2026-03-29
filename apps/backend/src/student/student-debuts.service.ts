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

  /** Full debut hierarchy containing only puzzles assigned to this student. */
  async listHierarchy(studentId: string) {
    const db = this.getDb();
    const rows = await db
      .select({
        levelId: debutLevels.id,
        levelName: debutLevels.name,
        levelCreatedAt: debutLevels.createdAt,
        courseId: courses.id,
        courseName: courses.name,
        courseCreatedAt: courses.createdAt,
        moduleId: modules.id,
        moduleName: modules.name,
        moduleCreatedAt: modules.createdAt,
        taskId: tasks.id,
        taskName: tasks.name,
        taskCreatedAt: tasks.createdAt,
        puzzleId: puzzles.id,
        puzzleName: puzzles.name,
        puzzleCreatedAt: puzzles.createdAt,
        assignmentId: puzzleAssignments.id,
        assignmentMode: puzzleAssignments.mode,
        assignmentPracticeLimit: puzzleAssignments.practiceLimit,
        assignmentPracticeAttemptsUsed: puzzleAssignments.practiceAttemptsUsed,
        assignmentAssignedAt: puzzleAssignments.assignedAt,
        assignmentCompletedAt: puzzleAssignments.completedAt,
      })
      .from(puzzleAssignments)
      .innerJoin(puzzles, eq(puzzles.id, puzzleAssignments.puzzleId))
      .innerJoin(tasks, eq(tasks.id, puzzles.taskId))
      .innerJoin(modules, eq(modules.id, tasks.moduleId))
      .innerJoin(courses, eq(courses.id, modules.courseId))
      .innerJoin(debutLevels, eq(debutLevels.id, courses.debutLevelId))
      .where(eq(puzzleAssignments.studentId, studentId))
      .orderBy(
        asc(debutLevels.createdAt),
        asc(courses.createdAt),
        asc(modules.createdAt),
        asc(tasks.createdAt),
        asc(puzzles.createdAt),
      );

    type HierarchyPuzzle = {
      id: string;
      name: string;
      createdAt: Date;
      assignment: {
        id: string;
        mode: "new" | "test";
        practiceLimit: number | null;
        practiceAttemptsUsed: number;
        assignedAt: Date;
        completedAt: Date | null;
      };
    };
    type HierarchyTask = { id: string; name: string; createdAt: Date; puzzles: HierarchyPuzzle[] };
    type HierarchyModule = { id: string; name: string; createdAt: Date; tasks: HierarchyTask[] };
    type HierarchyCourse = { id: string; name: string; createdAt: Date; modules: HierarchyModule[] };
    type HierarchyLevel = { id: string; name: string; createdAt: Date; courses: HierarchyCourse[] };

    const levels: HierarchyLevel[] = [];
    const levelMap = new Map<string, HierarchyLevel>();
    const courseMap = new Map<string, HierarchyCourse>();
    const moduleMap = new Map<string, HierarchyModule>();
    const taskMap = new Map<string, HierarchyTask>();

    for (const r of rows) {
      let level = levelMap.get(r.levelId);
      if (!level) {
        level = {
          id: r.levelId,
          name: r.levelName,
          createdAt: r.levelCreatedAt,
          courses: [],
        };
        levelMap.set(r.levelId, level);
        levels.push(level);
      }

      let course = courseMap.get(r.courseId);
      if (!course) {
        course = {
          id: r.courseId,
          name: r.courseName,
          createdAt: r.courseCreatedAt,
          modules: [],
        };
        courseMap.set(r.courseId, course);
        level.courses.push(course);
      }

      let module = moduleMap.get(r.moduleId);
      if (!module) {
        module = {
          id: r.moduleId,
          name: r.moduleName,
          createdAt: r.moduleCreatedAt,
          tasks: [],
        };
        moduleMap.set(r.moduleId, module);
        course.modules.push(module);
      }

      let task = taskMap.get(r.taskId);
      if (!task) {
        task = {
          id: r.taskId,
          name: r.taskName,
          createdAt: r.taskCreatedAt,
          puzzles: [],
        };
        taskMap.set(r.taskId, task);
        module.tasks.push(task);
      }

      task.puzzles.push({
        id: r.puzzleId,
        name: r.puzzleName,
        createdAt: r.puzzleCreatedAt,
        assignment: {
          id: r.assignmentId,
          mode: r.assignmentMode,
          practiceLimit: r.assignmentPracticeLimit,
          practiceAttemptsUsed: r.assignmentPracticeAttemptsUsed ?? 0,
          assignedAt: r.assignmentAssignedAt,
          completedAt: r.assignmentCompletedAt ?? null,
        },
      });
    }

    return levels;
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
        practiceLimit: puzzleAssignments.practiceLimit,
        practiceAttemptsUsed: puzzleAssignments.practiceAttemptsUsed,
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
        practiceLimit: r.practiceLimit ?? null,
        practiceAttemptsUsed: r.practiceAttemptsUsed ?? 0,
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
        practiceLimit: puzzleAssignments.practiceLimit,
        practiceAttemptsUsed: puzzleAssignments.practiceAttemptsUsed,
      })
      .from(puzzleAssignments)
      .where(and(eq(puzzleAssignments.puzzleId, input.puzzleId), eq(puzzleAssignments.studentId, input.studentId)))
      .limit(1);
    const assignment = a[0];
    if (!assignment) throw new ForbiddenException("Variant is locked");

    const rows = await db.select().from(puzzles).where(eq(puzzles.id, input.puzzleId)).limit(1);
    const puzzle = rows[0];
    if (!puzzle) throw new NotFoundException("Variant not found");

    if (assignment.mode === "test") {
      if (
        assignment.practiceLimit !== null &&
        (assignment.practiceAttemptsUsed ?? 0) >= assignment.practiceLimit
      ) {
        throw new ForbiddenException("Mashq urinishlar limiti tugagan");
      }
    }

    return {
      id: puzzle.id,
      taskId: puzzle.taskId,
      name: puzzle.name,
      moves: puzzle.moves,
      createdAt: puzzle.createdAt,
      mode: assignment.mode,
      practiceLimit: assignment.practiceLimit ?? null,
      practiceAttemptsUsed: assignment.practiceAttemptsUsed ?? 0,
    };
  }

  async consumePracticeAttemptForStudent(input: { puzzleId: string; studentId: string }) {
    const db = this.getDb();
    const rows = await db
      .select({
        assignmentId: puzzleAssignments.id,
        mode: puzzleAssignments.mode,
        practiceLimit: puzzleAssignments.practiceLimit,
        practiceAttemptsUsed: puzzleAssignments.practiceAttemptsUsed,
      })
      .from(puzzleAssignments)
      .where(
        and(
          eq(puzzleAssignments.puzzleId, input.puzzleId),
          eq(puzzleAssignments.studentId, input.studentId),
        ),
      )
      .limit(1);
    const assignment = rows[0];
    if (!assignment) throw new ForbiddenException("Variant is locked");
    if (assignment.mode !== "test") throw new ForbiddenException("Mashq rejimi emas");

    const used = assignment.practiceAttemptsUsed ?? 0;
    if (assignment.practiceLimit !== null && used >= assignment.practiceLimit) {
      throw new ForbiddenException("Mashq urinishlar limiti tugagan");
    }

    const updated = await db
      .update(puzzleAssignments)
      .set({ practiceAttemptsUsed: used + 1 })
      .where(eq(puzzleAssignments.id, assignment.assignmentId))
      .returning({
        practiceLimit: puzzleAssignments.practiceLimit,
        practiceAttemptsUsed: puzzleAssignments.practiceAttemptsUsed,
      });
    const next = updated[0];
    return {
      ok: true as const,
      practiceLimit: next?.practiceLimit ?? assignment.practiceLimit ?? null,
      practiceAttemptsUsed: next?.practiceAttemptsUsed ?? used + 1,
    };
  }
}
