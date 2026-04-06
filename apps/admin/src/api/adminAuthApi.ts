import { apiFetch as api } from "../auth/auth";

export const adminAuthApi = {
  changePassword: (input: { oldPassword: string; newPassword: string }) =>
    api<{ ok: true }>(`/auth/password`, { method: "PATCH", body: JSON.stringify(input) }),
};
