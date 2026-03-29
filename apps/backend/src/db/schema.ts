import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userType = pgEnum("user_type", ["student", "teacher"]);
export const puzzleAssignmentMode = pgEnum("puzzle_assignment_mode", ["new", "test"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: userType("type").notNull(),
  login: text("login").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const debutLevels = pgTable("debut_levels", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type DebutLevel = typeof debutLevels.$inferSelect;
export type NewDebutLevel = typeof debutLevels.$inferInsert;

export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  debutLevelId: uuid("debut_level_id")
    .notNull()
    .references(() => debutLevels.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;

export const modules = pgTable("modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Module = typeof modules.$inferSelect;
export type NewModule = typeof modules.$inferInsert;

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  moduleId: uuid("module_id")
    .notNull()
    .references(() => modules.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export const puzzles = pgTable("puzzles", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  moves: jsonb("moves").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Puzzle = typeof puzzles.$inferSelect;
export type NewPuzzle = typeof puzzles.$inferInsert;

export const puzzleAssignments = pgTable(
  "puzzle_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    puzzleId: uuid("puzzle_id")
      .notNull()
      .references(() => puzzles.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mode: puzzleAssignmentMode("mode").notNull().default("new"),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    puzzleStudentUnique: uniqueIndex("puzzle_assignments_puzzle_student_unique").on(t.puzzleId, t.studentId),
  }),
);

export type PuzzleAssignment = typeof puzzleAssignments.$inferSelect;
export type NewPuzzleAssignment = typeof puzzleAssignments.$inferInsert;
