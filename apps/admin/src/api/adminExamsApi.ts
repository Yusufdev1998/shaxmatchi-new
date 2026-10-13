import { apiFetch as api } from "../auth/auth";

export type Exam = {
  id: string;
  name: string;
  createdBy: string;
  secondsPerMove: number;
  attemptsAllowed: number;
  puzzleCount: number;
  cooldownSeconds: number;
  createdAt: string;
  taskIds?: string[];
};

export type ExamAssignment = {
  id: string;
  examId: string;
  teacherId: string;
  studentId: string;
  studentLogin: string;
  attemptsUsed: number;
  assignedAt: string;
  passed: number;
  failed: number;
  lastResult: "passed" | "failed" | null;
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

export type ExamAttemptRecord = {
  id: string;
  status: "in_progress" | "passed" | "failed";
  failDetail: ExamAttemptFailDetail | null;
  failDetails: ExamAttemptFailDetail[] | null;
  startedAt: string;
  completedAt: string | null;
  lastSeenAt: string;
  /** Set when the server failed the attempt because the student went silent (lost connection). */
  abandonedAt: string | null;
  progress: { puzzleIdx: number; moveIdx: number } | null;
  puzzleCount: number;
};

export type ExamInput = {
  name: string;
  secondsPerMove: number;
  attemptsAllowed: number;
  puzzleCount: number;
  cooldownSeconds: number;
  taskIds: string[];
};

export const adminExamsApi = {
  list: () => api<Exam[]>(`/admin/exams`),
  get: (examId: string) => api<Required<Exam>>(`/admin/exams/${examId}`),
  create: (input: ExamInput) =>
    api<Required<Exam>>(`/admin/exams`, { method: "POST", body: JSON.stringify(input) }),
  update: (examId: string, input: ExamInput) =>
    api<Required<Exam>>(`/admin/exams/${examId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  delete: (examId: string) =>
    api<{ ok: true }>(`/admin/exams/${examId}`, { method: "DELETE" }),

  listAssignments: (examId: string) =>
    api<ExamAssignment[]>(`/admin/exams/${examId}/assignments`),
  listAttempts: (examId: string, assignmentId: string) =>
    api<ExamAttemptRecord[]>(
      `/admin/exams/${examId}/assignments/${assignmentId}/attempts`,
    ),
  /** Refund and reopen an attempt that was failed only because the student went silent. */
  reopenAttempt: (examId: string, assignmentId: string, attemptId: string) =>
    api<{ ok: true }>(
      `/admin/exams/${examId}/assignments/${assignmentId}/attempts/${attemptId}/reopen`,
      { method: "POST" },
    ),
  assign: (examId: string, studentIds: string[]) =>
    api<{ created: number; updated: number }>(`/admin/exams/${examId}/assignments`, {
      method: "POST",
      body: JSON.stringify({ studentIds }),
    }),
  unassign: (examId: string, assignmentId: string) =>
    api<{ ok: true }>(`/admin/exams/${examId}/assignments/${assignmentId}`, {
      method: "DELETE",
    }),
};
