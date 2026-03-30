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

