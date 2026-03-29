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
    let message = text || `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (typeof parsed.message === "string") message = parsed.message;
      else if (Array.isArray(parsed.message)) message = parsed.message.join(", ");
    } catch {
      /* use raw text */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const adminAuthApi = {
  changePassword: (input: { oldPassword: string; newPassword: string }) =>
    api<{ ok: true }>(`/auth/password`, { method: "PATCH", body: JSON.stringify(input) }),
};
