import { apiFetch as api } from "../auth/auth";

export type Student = { id: string; login: string; type: "student"; telegramId?: string | null; createdAt?: string };

export type TelegramDeepLinkResponse = { deepLink: string; expiresAt: string };

export const adminUsersApi = {
  listStudents: () => api<Student[]>(`/users/students`),
  createStudent: (input: { login: string; password: string; telegramId?: string }) =>
    api<Student>(`/users/students`, { method: "POST", body: JSON.stringify(input) }),
  updateStudent: (studentId: string, input: { login?: string; password?: string; telegramId?: string }) =>
    api<Student>(`/users/students/${studentId}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteStudent: (studentId: string) => api<{ ok: true }>(`/users/students/${studentId}`, { method: "DELETE" }),
  issueTelegramLink: (studentId: string) =>
    api<TelegramDeepLinkResponse>(`/users/students/${studentId}/telegram-link`, { method: "POST" }),
};

