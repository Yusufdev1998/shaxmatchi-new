declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
          };
        };
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

export function getTelegramWebApp() {
  return window.Telegram?.WebApp;
}

export function isTelegramMiniApp() {
  return Boolean(getTelegramWebApp());
}

export function getTelegramInitData() {
  return getTelegramWebApp()?.initData ?? "";
}

export function initTelegramMiniApp() {
  const app = getTelegramWebApp();
  if (!app) return;
  app.ready?.();
  app.expand?.();
}
