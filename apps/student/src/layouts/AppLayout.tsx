import * as React from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@shaxmatchi/ui";
import { Download, LogOut, Home, Swords } from "lucide-react";
import { clearAuthSession, getAuthToken, getAuthUser } from "../auth/auth";
import { isTelegramMiniApp } from "../auth/telegram";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = getAuthToken();
  const user = getAuthUser();
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = React.useState(false);
  const inTelegram = isTelegramMiniApp();

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.type !== "student") {
    clearAuthSession();
    return <Navigate to="/login" replace state={{ from: location, reason: "wrong-role" }} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto w-full max-w-md px-4 py-2 sm:max-w-5xl sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight sm:text-base">O'quvchi</div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
                <Link className="hover:text-slate-900" to="/">
                  <Home className="mr-0.5 inline h-3 w-3" /> Bosh sahifa
                </Link>
                <Link className="hover:text-slate-900" to="/debut">
                  <Swords className="mr-0.5 inline h-3 w-3" /> Debyutlar
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden text-xs text-slate-600 sm:block">{user.login}</div>
              {!inTelegram && !isStandalone && deferredPrompt ? (
                <Button
                  variant="secondary"
                  className="h-8 px-3"
                  onClick={async () => {
                    const prompt = deferredPrompt;
                    if (!prompt) return;
                    await prompt.prompt();
                    await prompt.userChoice;
                    setDeferredPrompt(null);
                  }}
                >
                  <Download className="mr-1 h-3.5 w-3.5" /> Yuklab olish
                </Button>
              ) : null}
              {!inTelegram ? (
                <Button
                  variant="secondary"
                  className="h-8 px-3"
                  onClick={() => {
                    clearAuthSession();
                    navigate("/login", { replace: true });
                  }}
                >
                  <LogOut className="mr-1 h-3.5 w-3.5" /> Chiqish
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md px-4 py-4 sm:max-w-5xl sm:px-6 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}

