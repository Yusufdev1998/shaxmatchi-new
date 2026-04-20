import { API_URL, clearAuthSession, getAuthToken } from "../auth/auth";

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

export type AppSettings = {
  id: string;
  audioAutoplay: boolean;
  audioDelaySeconds: number;
  updatedAt: string;
};

export const studentSettingsApi = {
  get: () => api<AppSettings>(`/settings`),
};
