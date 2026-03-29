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

export type PuzzleMove = { san: string; explanation: string };
export type StudentPuzzleDetail = {
  id: string;
  taskId: string;
  name: string;
  moves: PuzzleMove[];
  createdAt: string;
  mode: AssignmentMode;
};

export const studentDebutsApi = {
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
};

