import { API_URL, clearAuthSession, getAuthToken } from "../auth/auth";
import type { PuzzleMove, PuzzleStudentSide } from "./studentDebutsApi";

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
  if (res.status === 401) {
    clearAuthSession();
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Nest returns `{ message, error, statusCode }` — surface just the message, so the
    // student sees "Bu urinish allaqachon yakunlangan" rather than a JSON blob.
    let message = text;
    try {
      const body = JSON.parse(text) as { message?: string | string[] };
      if (Array.isArray(body?.message)) message = body.message.join(", ");
      else if (typeof body?.message === "string") message = body.message;
    } catch {
      /* not JSON — fall back to the raw text */
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export type StudentExamSummary = {
  assignmentId: string;
  examId: string;
  name: string;
  secondsPerMove: number;
  attemptsAllowed: number;
  puzzleCount: number;
  cooldownSeconds: number;
  attemptsUsed: number;
  assignedAt: string;
};

export type StudentExamAttemptStatus = "in_progress" | "passed" | "failed";

export type StudentExamAttemptSummary = {
  id: string;
  status: StudentExamAttemptStatus;
  startedAt: string;
  completedAt: string | null;
};

export type StudentExamDetail = StudentExamSummary & {
  attempts: StudentExamAttemptSummary[];
};

export type StudentExamAttemptPuzzle = {
  id: string;
  name: string;
  moves: PuzzleMove[];
  studentSide: PuzzleStudentSide;
};

export type StudentExamAttemptStart = {
  attemptId: string;
  secondsPerMove: number;
  cooldownSeconds: number;
  attemptsLeft: number;
  puzzles: StudentExamAttemptPuzzle[];
};

export type ExamAttemptFailDetail = {
  puzzleId: string;
  puzzleName: string;
  puzzleIndex: number;
  moveIndex: number;
  moveNumber: number;
  reason: "wrong" | "timeout";
  playedSan: string | null;
  expectedSan: string | null;
};

export const studentExamsApi = {
  list: () => api<StudentExamSummary[]>(`/student/exams`),
  get: (examId: string) => api<StudentExamDetail>(`/student/exams/${examId}`),
  startAttempt: (examId: string) =>
    api<StudentExamAttemptStart>(`/student/exams/${examId}/attempts`, { method: "POST" }),
  /** Re-fetch an in-progress attempt (resume after a reload / PWA update). */
  getAttempt: (attemptId: string) =>
    api<StudentExamAttemptStart>(`/student/exams/attempts/${attemptId}`),
  /** Keep-alive so the server does not sweep a live attempt as abandoned. */
  heartbeat: (attemptId: string) =>
    api<{ ok: true }>(`/student/exams/attempts/${attemptId}/heartbeat`, { method: "POST" }),
  finalizeAttempt: (
    attemptId: string,
    result: "passed" | "failed",
    failDetails?: ExamAttemptFailDetail[],
  ) =>
    api<{ ok: true; status: StudentExamAttemptStatus }>(
      `/student/exams/attempts/${attemptId}`,
      { method: "PATCH", body: JSON.stringify({ result, failDetails }) },
    ),
};
