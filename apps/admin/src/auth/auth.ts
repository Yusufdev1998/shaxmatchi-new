export type AuthUser = {
  id: string;
  login: string;
  type: "student" | "teacher";
};

const TOKEN_KEY = "shaxmatchi_token";
const USER_KEY = "shaxmatchi_user";

export const API_URL: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuthSession(input: { accessToken: string; user: AuthUser }) {
  localStorage.setItem(TOKEN_KEY, input.accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(input.user));
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function handleUnauthorized() {
  clearAuthSession();
  window.location.replace("/login");
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
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
    handleUnauthorized();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const error = new Error(text || `HTTP ${res.status}`) as Error & {
      status?: number;
    };
    error.status = res.status;
    throw error;
  }
  return (await res.json()) as T;
}

export async function apiUploadFetch<T>(path: string, file: File): Promise<T> {
  const token = getAuthToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const error = new Error(text || `HTTP ${res.status}`) as Error & {
      status?: number;
    };
    error.status = res.status;
    throw error;
  }
  return (await res.json()) as T;
}
