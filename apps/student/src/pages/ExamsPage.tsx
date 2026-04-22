import * as React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@shaxmatchi/ui";
import { ChevronRight, GraduationCap } from "lucide-react";
import { studentExamsApi, type StudentExamSummary } from "../api/studentExamsApi";

export function ExamsPage() {
  const examsQuery = useQuery({
    queryKey: ["studentExams"],
    queryFn: studentExamsApi.list,
  });

  const exams: StudentExamSummary[] = examsQuery.data ?? [];

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Imtihonlar</h1>
        <p className="mt-2 text-sm text-slate-600">
          Tayinlangan imtihonlar. Har bir imtihon N ta tasodifiy pazldan iborat, har yurishga cheklangan vaqt beriladi.
        </p>
      </div>

      {examsQuery.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
          Yuklanmoqda…
        </div>
      ) : examsQuery.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {examsQuery.error instanceof Error ? examsQuery.error.message : "Imtihonlarni yuklab bo'lmadi"}
        </div>
      ) : exams.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
          Hozircha sizga imtihonlar tayinlanmagan.
        </div>
      ) : (
        <div className="space-y-2">
          {exams.map((e) => {
            const remaining = Math.max(0, e.attemptsAllowed - e.attemptsUsed);
            const exhausted = remaining === 0;
            return (
              <Link
                key={e.assignmentId}
                to={`/exams/${e.examId}`}
                className={`flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors ${
                  exhausted ? "opacity-70" : "hover:bg-slate-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 shrink-0 text-slate-600" />
                    <div className="min-w-0 truncate text-sm font-semibold text-slate-900">{e.name}</div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span>⏱ {e.secondsPerMove}s/yurish</span>
                    <span>📚 {e.puzzleCount} pazl</span>
                    <span className={exhausted ? "text-red-600" : ""}>
                      🔁 {remaining}/{e.attemptsAllowed} urinish qoldi
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </Link>
            );
          })}
        </div>
      )}

      <div className="pt-2">
        <Button asChild variant="secondary">
          <Link to="/">Bosh sahifaga qaytish</Link>
        </Button>
      </div>
    </div>
  );
}
