import * as React from "react";
import { TruncatedText } from "@shaxmatchi/ui";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { studentDebutsApi } from "../api/studentDebutsApi";

export function DebutPage() {
  const navigate = useNavigate();
  const levelsQuery = useQuery({
    queryKey: ["studentDebuts", "levels"],
    queryFn: studentDebutsApi.listLevels,
  });

  const loading = levelsQuery.isLoading;
  const error = levelsQuery.error;
  const levels = levelsQuery.data ?? [];

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Debyutlar</h1>
        <p className="mt-1 text-sm text-slate-600">
          O'qituvchi tomonidan sizga tayinlangan vazifalar darajalari. Keyingi: kurs → modul → vazifa → pazllar.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 shadow-sm sm:p-4">
          {error instanceof Error ? error.message : "Yuklab bo'lmadi"}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm sm:p-4">
          Yuklanmoqda…
        </div>
      ) : levels.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-600">
          Hali tayinlangan debyutlar yo'q. O'qituvchi pazllarni tayinlaganda, ular shu yerda paydo bo'ladi.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {levels.map((l) => (
            <button
              key={l.id}
              type="button"
              className="w-full px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
              onClick={() => navigate(`/debut/levels/${l.id}/courses`)}
            >
              <div className="min-w-0">
                <TruncatedText text={l.name} className="text-sm font-medium text-slate-900" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
