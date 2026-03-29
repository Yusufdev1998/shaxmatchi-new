import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@shaxmatchi/ui";
import { LogOut, Home, Swords } from "lucide-react";
import { clearAuthSession, getAuthToken, getAuthUser } from "../auth/auth";

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = getAuthToken();
  const user = getAuthUser();

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

