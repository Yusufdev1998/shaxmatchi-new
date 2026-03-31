import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@shaxmatchi/ui";

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    "inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-slate-900 text-white shadow-sm"
      : "text-slate-700 hover:bg-slate-100",
  ].join(" ");

export function StatisticsLayout() {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={() => navigate("/")}>
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
          Ortga
        </Button>
      </div>
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Statistika</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          O‘quvchilar va kontent bo‘yicha ko‘rsatkichlar. Har bir bo‘lim alohida sahifada ochiladi.
        </p>
      </div>

      {/* Yangi stat: `pages/stats/...` sahifasi + router `children` + shu yerga NavLink qo‘shing */}
      <nav className="flex flex-wrap gap-1 border-b border-slate-200 pb-3" aria-label="Statistika bo‘limlari">
        <NavLink to="/stats" end className={navClass}>
          Bosh sahifa
        </NavLink>
        <NavLink to="/stats/learning-time" className={navClass}>
          O‘rganish vaqti
        </NavLink>
        <NavLink to="/stats/practice" className={navClass}>
          Mashq
        </NavLink>
      </nav>

      <Outlet />
    </div>
  );
}
