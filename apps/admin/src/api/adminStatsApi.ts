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

/** One o'rganish tayinlovi: variant + o'quvchi + jami vaqt. */
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

/** Mashq tayinlovi: urinishlar, muvaffaqiyat, xato, qoldi. */
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
  practiceAttemptsUsed: number;
  practiceSuccessCount: number;
  practiceFailCount: number;
  practiceFailureProgressSum: number;
  /** Xato qilgan joyning o‘rtacha foizi (mashq bo‘yicha qancha bosqichda). */
  averageFailProgressPercent: number | null;
  practiceLeft: number | null;
  assignedAt: string;
  completedAt: string | null;
};

export const adminStatsApi = {
  /**
   * Barcha o'rganish tayinlovlari (variant bo'yicha jami vaqt).
   * Kelajakda boshqa statistikalar alohida metodlar qo'shiladi.
   */
  listLearningPuzzles: () => api<LearningPuzzleStatRow[]>(`/admin/stats/learning-puzzles`),

  listPracticePuzzles: () => api<PracticePuzzleStatRow[]>(`/admin/stats/practice-puzzles`),
};
