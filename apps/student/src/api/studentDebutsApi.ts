import { API_URL, getAuthToken } from "../auth/auth";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export type Level = { id: string; name: string; createdAt: string };
export type Course = { id: string; debutLevelId: string; name: string; createdAt: string };
export type Module = { id: string; courseId: string; name: string; createdAt: string };
export type Task = { id: string; moduleId: string; name: string; createdAt: string };

export type AssignmentMode = "new" | "test";
export type StudentPuzzleAssignment = {
  id: string;
  mode: AssignmentMode;
  practiceLimit: number | null;
  practiceAttemptsUsed: number;
  assignedAt: string;
  completedAt: string | null;
};

export type StudentPuzzleSummary = {
  id: string;
  taskId: string;
  name: string;
  createdAt: string;
  locked: boolean;
  assignment: StudentPuzzleAssignment | null;
};

export type PuzzleBoardArrow = { startSquare: string; endSquare: string; color?: string };
export type PuzzleMove = {
  san: string;
  explanation: string;
  circles?: string[];
  arrows?: PuzzleBoardArrow[];
};
export type PuzzleStudentSide = "white" | "black";
export type StudentPuzzleDetail = {
  id: string;
  taskId: string;
  name: string;
  moves: PuzzleMove[];
  studentSide: PuzzleStudentSide;
  createdAt: string;
  mode: AssignmentMode;
  practiceLimit: number | null;
  practiceAttemptsUsed: number;
};

export type ConsumePracticeAttemptResult = {
  ok: true;
  practiceLimit: number | null;
  practiceAttemptsUsed: number;
};

export type StudentHierarchyPuzzle = {
  id: string;
  name: string;
  createdAt: string;
  assignment: StudentPuzzleAssignment;
};

export type StudentHierarchyTask = {
  id: string;
  name: string;
  createdAt: string;
  puzzles: StudentHierarchyPuzzle[];
};

export type StudentHierarchyModule = {
  id: string;
  name: string;
  createdAt: string;
  tasks: StudentHierarchyTask[];
};

export type StudentHierarchyCourse = {
  id: string;
  name: string;
  createdAt: string;
  modules: StudentHierarchyModule[];
};

export type StudentHierarchyLevel = {
  id: string;
  name: string;
  createdAt: string;
  courses: StudentHierarchyCourse[];
};

async function listHierarchyFallback(): Promise<StudentHierarchyLevel[]> {
  const levels = await studentDebutsApi.listLevels();
  const levelsWithCourses = await Promise.all(
    levels.map(async (level) => {
      const courses = await studentDebutsApi.listCourses(level.id);
      const coursesWithModules = await Promise.all(
        courses.map(async (course) => {
          const modules = await studentDebutsApi.listModules(level.id, course.id);
          const modulesWithTasks = await Promise.all(
            modules.map(async (module) => {
              const tasks = await studentDebutsApi.listTasks(level.id, course.id, module.id);
              const tasksWithPuzzles = await Promise.all(
                tasks.map(async (task) => {
                  const puzzles = await studentDebutsApi.listPuzzles(level.id, course.id, module.id, task.id);
                  return {
                    id: task.id,
                    name: task.name,
                    createdAt: task.createdAt,
                    puzzles: puzzles
                      .filter((p) => p.assignment !== null)
                      .map((p) => ({
                        id: p.id,
                        name: p.name,
                        createdAt: p.createdAt,
                        assignment: p.assignment!,
                      })),
                  };
                }),
              );

              return {
                id: module.id,
                name: module.name,
                createdAt: module.createdAt,
                tasks: tasksWithPuzzles.filter((task) => task.puzzles.length > 0),
              };
            }),
          );

          return {
            id: course.id,
            name: course.name,
            createdAt: course.createdAt,
            modules: modulesWithTasks.filter((module) => module.tasks.length > 0),
          };
        }),
      );

      return {
        id: level.id,
        name: level.name,
        createdAt: level.createdAt,
        courses: levelsWithCoursesFilter(coursesWithModules),
      };
    }),
  );

  return levelsWithCourses.filter((level) => level.courses.length > 0);
}

function levelsWithCoursesFilter(courses: StudentHierarchyCourse[]): StudentHierarchyCourse[] {
  return courses.filter((course) => course.modules.length > 0);
}

export const studentDebutsApi = {
  listHierarchy: async () => {
    try {
      return await api<StudentHierarchyLevel[]>(`/student/debuts/hierarchy`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      const shouldFallback =
        message.includes("Cannot GET /student/debuts/hierarchy") ||
        message.includes("HTTP 404");
      if (!shouldFallback) throw e;
      return listHierarchyFallback();
    }
  },
  listLevels: () => api<Level[]>(`/student/debuts/levels`),
  listCourses: (levelId: string) => api<Course[]>(`/student/debuts/levels/${levelId}/courses`),
  listModules: (levelId: string, courseId: string) =>
    api<Module[]>(`/student/debuts/levels/${levelId}/courses/${courseId}/modules`),
  listTasks: (levelId: string, courseId: string, moduleId: string) =>
    api<Task[]>(`/student/debuts/levels/${levelId}/courses/${courseId}/modules/${moduleId}/tasks`),
  listPuzzles: (levelId: string, courseId: string, moduleId: string, taskId: string) =>
    api<StudentPuzzleSummary[]>(
      `/student/debuts/levels/${levelId}/courses/${courseId}/modules/${moduleId}/tasks/${taskId}/puzzles`,
    ),
  getPuzzle: (puzzleId: string) => api<StudentPuzzleDetail>(`/student/puzzles/${puzzleId}`),
  consumePracticeAttempt: (puzzleId: string) =>
    api<ConsumePracticeAttemptResult>(`/student/puzzles/${puzzleId}/consume-attempt`, {
      method: "POST",
    }),
};

