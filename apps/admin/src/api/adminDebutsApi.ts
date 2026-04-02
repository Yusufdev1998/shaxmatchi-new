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
    const error = new Error(text || `HTTP ${res.status}`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return (await res.json()) as T;
}

function isPracticeLimitNotSupportedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("property practicelimit should not exist") ||
    message.includes('"practicelimit" should not exist')
  );
}

export type Level = { id: string; name: string; createdAt: string };
export type Course = { id: string; debutLevelId: string; name: string; createdAt: string };
export type Module = { id: string; courseId: string; name: string; createdAt: string };
export type Task = { id: string; moduleId: string; name: string; createdAt: string };
/** Board overlay for a move’s explanation (stored with the move in JSON). */
export type PuzzleBoardCircle = { square: string; color?: string };
export type PuzzleBoardArrow = { startSquare: string; endSquare: string; color?: string };
export type PuzzleMove = {
  san: string;
  explanation: string;
  /** Legacy API responses may still use `string[]` (square names only); normalize when editing. */
  circles?: PuzzleBoardCircle[] | string[];
  arrows?: PuzzleBoardArrow[];
  audioUrl?: string;
};
export type PuzzleStudentSide = "white" | "black";
export type Puzzle = {
  id: string;
  taskId: string;
  name: string;
  moves: PuzzleMove[];
  studentSide: PuzzleStudentSide;
  createdAt: string;
};
export type PuzzleAssignmentMode = "new" | "test";
export type PuzzleAssignment = {
  id: string;
  puzzleId: string;
  teacherId: string;
  studentId: string;
  studentLogin?: string;
  mode: PuzzleAssignmentMode;
  practiceLimit: number | null;
  practiceAttemptsUsed: number;
  /** Mashq: muvaffaqiyatli to'liq chiziqlar. */
  practiceSuccessCount: number;
  /** Mashq: xato progress foizlari yig‘indisi (ichki). */
  practiceFailureProgressSum: number;
  /** Total seconds in o'rganish (study + repeat) for this assignment. */
  learningSecondsTotal: number;
  assignedAt: string;
  completedAt: string | null;
};

async function apiUpload<T>(path: string, file: File): Promise<T> {
  const token = getAuthToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const error = new Error(text || `HTTP ${res.status}`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return (await res.json()) as T;
}

export const adminDebutsApi = {
  // levels
  listLevels: () => api<Level[]>(`/admin/debuts/levels`),
  createLevel: (name: string) => api<Level>(`/admin/debuts/levels`, { method: "POST", body: JSON.stringify({ name }) }),
  updateLevel: (levelId: string, name: string) =>
    api<Level>(`/admin/debuts/levels/${levelId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deleteLevel: (levelId: string) => api<{ ok: true }>(`/admin/debuts/levels/${levelId}`, { method: "DELETE" }),

  // courses
  listCourses: (levelId: string) => api<Course[]>(`/admin/debuts/levels/${levelId}/courses`),
  createCourse: (levelId: string, name: string) =>
    api<Course>(`/admin/debuts/levels/${levelId}/courses`, { method: "POST", body: JSON.stringify({ name }) }),
  updateCourse: (levelId: string, courseId: string, name: string) =>
    api<Course>(`/admin/debuts/levels/${levelId}/courses/${courseId}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  deleteCourse: (levelId: string, courseId: string) =>
    api<{ ok: true }>(`/admin/debuts/levels/${levelId}/courses/${courseId}`, { method: "DELETE" }),

  // modules
  listModules: (levelId: string, courseId: string) =>
    api<Module[]>(`/admin/debuts/levels/${levelId}/courses/${courseId}/modules`),
  createModule: (levelId: string, courseId: string, name: string) =>
    api<Module>(`/admin/debuts/levels/${levelId}/courses/${courseId}/modules`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  updateModule: (levelId: string, courseId: string, moduleId: string, name: string) =>
    api<Module>(`/admin/debuts/levels/${levelId}/courses/${courseId}/modules/${moduleId}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  deleteModule: (levelId: string, courseId: string, moduleId: string) =>
    api<{ ok: true }>(`/admin/debuts/levels/${levelId}/courses/${courseId}/modules/${moduleId}`, {
      method: "DELETE",
    }),

  // tasks
  listTasks: (levelId: string, courseId: string, moduleId: string) =>
    api<Task[]>(`/admin/debuts/levels/${levelId}/courses/${courseId}/modules/${moduleId}/tasks`),
  createTask: (levelId: string, courseId: string, moduleId: string, name: string) =>
    api<Task>(`/admin/debuts/levels/${levelId}/courses/${courseId}/modules/${moduleId}/tasks`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  updateTask: (levelId: string, courseId: string, moduleId: string, taskId: string, name: string) =>
    api<Task>(`/admin/debuts/levels/${levelId}/courses/${courseId}/modules/${moduleId}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  deleteTask: (levelId: string, courseId: string, moduleId: string, taskId: string) =>
    api<{ ok: true }>(`/admin/debuts/levels/${levelId}/courses/${courseId}/modules/${moduleId}/tasks/${taskId}`, {
      method: "DELETE",
    }),

  // puzzles
  listPuzzles: (levelId: string, courseId: string, moduleId: string, taskId: string) =>
    api<Puzzle[]>(`/admin/debuts/levels/${levelId}/courses/${courseId}/modules/${moduleId}/tasks/${taskId}/puzzles`),
  createPuzzle: (
    levelId: string,
    courseId: string,
    moduleId: string,
    taskId: string,
    input: { name: string; moves: PuzzleMove[]; studentSide?: PuzzleStudentSide },
  ) =>
    api<Puzzle>(`/admin/debuts/levels/${levelId}/courses/${courseId}/modules/${moduleId}/tasks/${taskId}/puzzles`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updatePuzzle: (
    levelId: string,
    courseId: string,
    moduleId: string,
    taskId: string,
    puzzleId: string,
    input: { name: string; moves: PuzzleMove[]; studentSide?: PuzzleStudentSide },
  ) =>
    api<Puzzle>(
      `/admin/debuts/levels/${levelId}/courses/${courseId}/modules/${moduleId}/tasks/${taskId}/puzzles/${puzzleId}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),
  deletePuzzle: (levelId: string, courseId: string, moduleId: string, taskId: string, puzzleId: string) =>
    api<{ ok: true }>(
      `/admin/debuts/levels/${levelId}/courses/${courseId}/modules/${moduleId}/tasks/${taskId}/puzzles/${puzzleId}`,
      { method: "DELETE" },
    ),

  // assignments
  assignPuzzleToStudent: (
    levelId: string,
    courseId: string,
    moduleId: string,
    taskId: string,
    puzzleId: string,
    input: { studentId: string; mode: PuzzleAssignmentMode; practiceLimit?: number },
  ) =>
    (async () => {
      const path = `/admin/debuts/levels/${levelId}/courses/${courseId}/modules/${moduleId}/tasks/${taskId}/puzzles/${puzzleId}/assignments`;
      if (input.practiceLimit === undefined) {
        return api<PuzzleAssignment>(path, { method: "POST", body: JSON.stringify(input) });
      }
      try {
        return await api<PuzzleAssignment>(path, { method: "POST", body: JSON.stringify(input) });
      } catch (e) {
        const status = typeof e === "object" && e !== null && "status" in e ? (e as { status?: number }).status : undefined;
        if (status !== 400 && !isPracticeLimitNotSupportedError(e)) throw e;
        const { practiceLimit: _ignored, ...legacyInput } = input;
        return api<PuzzleAssignment>(path, { method: "POST", body: JSON.stringify(legacyInput) });
      }
    })(),

  listPuzzleAssignments: (levelId: string, courseId: string, moduleId: string, taskId: string, puzzleId: string) =>
    api<PuzzleAssignment[]>(
      `/admin/debuts/levels/${levelId}/courses/${courseId}/modules/${moduleId}/tasks/${taskId}/puzzles/${puzzleId}/assignments`,
    ),

  deletePuzzleAssignment: (
    levelId: string,
    courseId: string,
    moduleId: string,
    taskId: string,
    puzzleId: string,
    assignmentId: string,
  ) =>
    api<{ ok: true }>(
      `/admin/debuts/levels/${levelId}/courses/${courseId}/modules/${moduleId}/tasks/${taskId}/puzzles/${puzzleId}/assignments/${assignmentId}`,
      { method: "DELETE" },
    ),

  // audio uploads
  uploadAudio: (file: File) =>
    apiUpload<{ filename: string }>(`/admin/uploads/audio`, file),

  deleteAudio: (filename: string) =>
    api<{ ok: true }>(`/admin/uploads/audio/${encodeURIComponent(filename)}`, { method: "DELETE" }),
};

