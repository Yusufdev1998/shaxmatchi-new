import { apiFetch as api } from "../auth/auth";

export type AppSettings = {
  id: string;
  audioAutoplay: boolean;
  audioDelaySeconds: number;
  updatedAt: string;
};

export const adminSettingsApi = {
  get: () => api<AppSettings>(`/settings`),
  update: (input: { audioAutoplay?: boolean; audioDelaySeconds?: number }) =>
    api<AppSettings>(`/settings`, { method: "PATCH", body: JSON.stringify(input) }),
};
