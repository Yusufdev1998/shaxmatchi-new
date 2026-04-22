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
    throw new Error(text || `HTTP ${res.status}`);
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
  attemptsLeft: number;
  puzzles: StudentExamAttemptPuzzle[];
};

export const studentExamsApi = {
  list: () => api<StudentExamSummary[]>(`/student/exams`),
  get: (examId: string) => api<StudentExamDetail>(`/student/exams/${examId}`),
  startAttempt: (examId: string) =>
    api<StudentExamAttemptStart>(`/student/exams/${examId}/attempts`, { method: "POST" }),
  finalizeAttempt: (attemptId: string, result: "passed" | "failed") =>
    api<{ ok: true; status: StudentExamAttemptStatus }>(
      `/student/exams/attempts/${attemptId}`,
      { method: "PATCH", body: JSON.stringify({ result }) },
    ),
};
