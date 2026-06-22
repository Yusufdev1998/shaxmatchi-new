import { apiFetch } from "../auth/auth";

export type PushPublicKey = { publicKey: string | null; enabled: boolean };

export const pushApi = {
  getPublicKey: () => apiFetch<PushPublicKey>("/admin/push/public-key"),

  subscribe: (subscription: PushSubscriptionJSON, userAgent?: string) =>
    apiFetch<{ ok: true }>("/admin/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription, userAgent }),
    }),

  unsubscribe: (endpoint: string) =>
    apiFetch<{ ok: true }>("/admin/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint }),
    }),
};
