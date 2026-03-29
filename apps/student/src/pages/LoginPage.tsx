import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@shaxmatchi/ui";
import { LogIn } from "lucide-react";
import { API_URL, clearAuthSession, setAuthSession } from "../auth/auth";

type LoginResponse = {
  accessToken: string;
  user: { id: string; login: string; type: "student" | "teacher" };
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [login, setLogin] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const from = (location.state as any)?.from?.pathname ?? "/";
  const reason = (location.state as any)?.reason as string | undefined;

  React.useEffect(() => {
    if (reason === "wrong-role") {
      setError("Bu hisob O'quvchi ilovasiga kira olmaydi (faqat o'quvchi).");
    }
  }, [reason]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });

      if (!res.ok) {
        const msg = res.status === 401 ? "Login yoki parol noto'g'ri" : `Kirish xatosi (HTTP ${res.status})`;
        throw new Error(msg);
      }

      const json = (await res.json()) as LoginResponse;

      if (json.user.type !== "student") {
        clearAuthSession();
        throw new Error("Bu hisob O'quvchi ilovasiga kira olmaydi (faqat o'quvchi).");
      }

      setAuthSession({ accessToken: json.accessToken, user: json.user });
      navigate(from, { replace: true });
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Kirish xatosi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">O'quvchi kirish</h1>
          <p className="text-sm text-slate-600">Login va parol bilan kiring.</p>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <label className="block space-y-1">
            <div className="text-xs font-medium text-slate-700">Login</div>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="block space-y-1">
            <div className="text-xs font-medium text-slate-700">Parol</div>
            <input
              type="password"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <Button className="w-full" disabled={loading}>
            {loading ? "Kirish..." : <><LogIn className="mr-1.5 h-4 w-4" /> Kirish</>}
          </Button>
        </form>
      </div>
    </div>
  );
}

