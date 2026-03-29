export type AuthUser = {
  id: string;
  login: string;
  type: "student" | "teacher";
};

const TOKEN_KEY = "shaxmatchi_token";
const USER_KEY = "shaxmatchi_user";

export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

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

