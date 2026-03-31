import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { and, desc, eq } from "drizzle-orm";
import type { DrizzleDb } from "../db";
import { courses, debutLevels, modules, puzzleAssignments, puzzles, tasks, users } from "../db/schema";
import { DRIZZLE_DB } from "../db/tokens";

@Injectable()
export class DebutsService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null) {}

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
    return this.getDb().select().from(puzzles).where(eq(puzzles.taskId, taskId));
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
        circles?: string[];
        arrows?: Array<{ startSquare: string; endSquare: string; color?: string }>;
      }>;
      studentSide?: "white" | "black";
    },
  ) {
    await this.getTask(levelId, courseId, moduleId, taskId);
    const studentSide = input.studentSide ?? "white";
    const rows = await this.getDb()
      .insert(puzzles)
      .values({ taskId, name: input.name, moves: input.moves, studentSide })
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
        circles?: string[];
        arrows?: Array<{ startSquare: string; endSquare: string; color?: string }>;
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
  }) {
    const db = this.getDb();
    await this.getPuzzle(input.levelId, input.courseId, input.moduleId, input.taskId, input.puzzleId);

    const studentRows = await db
      .select({ id: users.id, type: users.type })
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

    if (existing) {
      const rows = await db
        .update(puzzleAssignments)
        .set({
          teacherId: input.teacherId,
          mode: input.mode,
          practiceLimit: input.mode === "test" ? input.practiceLimit : null,
          practiceAttemptsUsed: 0,
          assignedAt: new Date(),
          completedAt: null,
        })
        .where(eq(puzzleAssignments.id, existing.id))
        .returning();
      return rows[0]!;
    }

    const rows = await db
      .insert(puzzleAssignments)
      .values({
        puzzleId: input.puzzleId,
        teacherId: input.teacherId,
        studentId: input.studentId,
        mode: input.mode,
        practiceLimit: input.mode === "test" ? input.practiceLimit : null,
        practiceAttemptsUsed: 0,
      })
      .returning();
    return rows[0]!;
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

