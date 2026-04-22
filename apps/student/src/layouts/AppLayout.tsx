import * as React from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@shaxmatchi/ui";
import { BookOpen, ChevronLeft, Download, Dumbbell, GraduationCap, LogOut, Home, Swords, RefreshCw } from "lucide-react";
import { clearAuthSession, getAuthToken, getAuthUser } from "../auth/auth";
import { isTelegramMiniApp } from "../auth/telegram";
import { getPwaUpdateFn, subscribePwaUpdate } from "../pwaUpdate";

export type StudentHeaderOverride = {
  title: string;
  mode?: "new" | "test";
  /** Optional compact badge text (e.g. "3/5" for attempts). */
  meta?: string;
  backTo?: string;
} | null;

const StudentHeaderCtx = React.createContext<{
  setOverride: (o: StudentHeaderOverride) => void;
} | null>(null);

/** Replace the default header content while this page is mounted. */
export function useStudentPageHeader(override: StudentHeaderOverride) {
  const ctx = React.useContext(StudentHeaderCtx);
  const key = override ? `${override.title}|${override.mode ?? ""}|${override.meta ?? ""}|${override.backTo ?? ""}` : "";
  React.useEffect(() => {
    if (!ctx) return;
    ctx.setOverride(override);
    return () => ctx.setOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, key]);
}

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
  const [pwaUpdateReady, setPwaUpdateReady] = React.useState(() => !!getPwaUpdateFn());
  const [headerOverride, setHeaderOverride] = React.useState<StudentHeaderOverride>(null);
  const headerCtxValue = React.useMemo(
    () => ({ setOverride: setHeaderOverride }),
    [],
  );

  React.useEffect(() => {
    return subscribePwaUpdate(() => setPwaUpdateReady(true));
  }, []);

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
    <StudentHeaderCtx.Provider value={headerCtxValue}>
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto w-full max-w-md px-4 py-2 sm:max-w-5xl sm:px-6">
          <div className="flex items-center justify-between gap-3">
            {headerOverride ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {headerOverride.backTo ? (
                  <Link
                    to={headerOverride.backTo}
                    className="-ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Orqaga"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Link>
                ) : null}
                <h1 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight sm:text-base">
                  {headerOverride.title}
                </h1>
                {headerOverride.mode === "test" ? (
                  <Dumbbell className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                ) : headerOverride.mode === "new" ? (
                  <BookOpen className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                ) : null}
                {headerOverride.meta ? (
                  <span className="shrink-0 font-mono text-xs text-slate-500">
                    {headerOverride.meta}
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-tight sm:text-base">O'quvchi</div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
                  <Link className="hover:text-slate-900" to="/">
                    <Home className="mr-0.5 inline h-3 w-3" /> Bosh sahifa
                  </Link>
                  <Link className="hover:text-slate-900" to="/debut">
                    <Swords className="mr-0.5 inline h-3 w-3" /> Debyutlar
                  </Link>
                  <Link className="hover:text-slate-900" to="/exams">
                    <GraduationCap className="mr-0.5 inline h-3 w-3" /> Imtihonlar
                  </Link>
                </div>
              </div>
            )}
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

      {pwaUpdateReady ? (
        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-center">
          <span className="text-xs text-emerald-800">Yangi versiya mavjud!</span>
          <Button
            variant="default"
            className="ml-2 h-6 px-2 text-xs"
            onClick={() => {
              const fn = getPwaUpdateFn();
              if (fn) fn();
            }}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Yangilash
          </Button>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-md px-4 py-4 sm:max-w-5xl sm:px-6 sm:py-6">
        <Outlet />
      </main>
    </div>
    </StudentHeaderCtx.Provider>
  );
}

