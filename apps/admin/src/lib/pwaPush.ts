import { pushApi } from "../api/pushApi";

export type PushState = {
  supported: boolean;
  /** Notification permission: "default" | "granted" | "denied". */
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  /** Whether the backend has VAPID configured. */
  serverEnabled: boolean;
};

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Convert a base64url VAPID public key to the Uint8Array the Push API expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) {
    return { supported: false, permission: "unsupported", subscribed: false, serverEnabled: false };
  }
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    subscribed = Boolean(sub);
  } catch {
    /* ignore */
  }
  let serverEnabled = false;
  try {
    const { enabled } = await pushApi.getPublicKey();
    serverEnabled = enabled;
  } catch {
    /* ignore */
  }
  return {
    supported: true,
    permission: Notification.permission,
    subscribed,
    serverEnabled,
  };
}

/**
 * Request permission, subscribe via the service worker, and register the
 * subscription with the backend. Throws on failure (denied / unsupported / no key).
 */
export async function enablePush(): Promise<void> {
  if (!isPushSupported()) throw new Error("Push not supported");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("permission-denied");

  const { publicKey, enabled } = await pushApi.getPublicKey();
  if (!enabled || !publicKey) throw new Error("server-disabled");

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await pushApi.subscribe(sub.toJSON(), navigator.userAgent);
}

export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } finally {
    await pushApi.unsubscribe(endpoint).catch(() => undefined);
  }
}
