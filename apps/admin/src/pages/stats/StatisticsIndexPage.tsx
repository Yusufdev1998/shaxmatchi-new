import { Link } from "react-router-dom";
import { BookOpen, Dumbbell, LayoutGrid } from "lucide-react";
import { AdminBreadcrumb } from "../../components/AdminBreadcrumb";

export function StatisticsIndexPage() {
  return (
    <div className="space-y-4">
      <AdminBreadcrumb compact items={[{ label: "Statistika" }]} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/stats/learning-time"
          className="group flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 group-hover:bg-indigo-100">
            <BookOpen className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">O‘rganish vaqti</div>
            <p className="mt-0.5 text-xs text-slate-600">
              O‘rganish rejimidagi variantlar bo‘yicha har bir o‘quvchi uchun jami vaqt.
            </p>
          </div>
        </Link>

        <Link
          to="/stats/practice"
          className="group flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-800 group-hover:bg-amber-100">
            <Dumbbell className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">Mashq statistikasi</div>
            <p className="mt-0.5 text-xs text-slate-600">
              Urinishlar: muvaffaqiyat, xato va qolgan limit bo‘yicha.
            </p>
          </div>
        </Link>

        <div className="flex gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4 text-slate-500 sm:col-span-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
            <LayoutGrid className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-600">Boshqa statistikalar</div>
            <p className="mt-0.5 text-xs">Keyingi ko‘rsatkichlar uchun alohida sahifalar qo‘shiladi.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
