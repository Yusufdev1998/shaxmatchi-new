import * as React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  TruncatedText,
} from "@shaxmatchi/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BookOpen, Dumbbell } from "lucide-react";
import { studentDebutsApi } from "../api/studentDebutsApi";

function assignmentModeLabel(mode: "new" | "test"): string {
  return mode === "test" ? "mashq" : "o'rganish";
}

export function DebutPuzzlesPage() {
  const navigate = useNavigate();
  const params = useParams();
  const levelId = params.levelId;
  const courseId = params.courseId;
  const moduleId = params.moduleId;
  const taskId = params.taskId;
  if (!levelId || !courseId || !moduleId || !taskId) return <div className="text-sm text-slate-600">Missing params</div>;

  const hierarchyQuery = useQuery({
    queryKey: ["studentDebuts", "hierarchy"],
    queryFn: studentDebutsApi.listHierarchy,
  });

  const level = hierarchyQuery.data?.find((l) => l.id === levelId);
  const course = level?.courses.find((c) => c.id === courseId);
  const module = course?.modules.find((m) => m.id === moduleId);
  const task = module?.tasks.find((t) => t.id === taskId);
  const levelName = level?.name ?? "Daraja";
  const courseName = course?.name ?? "Kurs";
  const moduleName = module?.name ?? "Modul";
  const taskName = task?.name ?? "Vazifa";
  const loading = hierarchyQuery.isLoading;
  const error = hierarchyQuery.error;
  const puzzles = task?.puzzles ?? [];

  return (
    <div className="space-y-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/debut">Debyutlar</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/debut/levels/${levelId}/courses`}>{levelName}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/debut/levels/${levelId}/courses/${courseId}/modules`}>{courseName}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/debut/levels/${levelId}/courses/${courseId}/modules/${moduleId}/tasks`}>{moduleName}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{taskName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Variantlar</h1>
        <p className="mt-1 text-sm text-slate-600">Vazifa: {taskName}</p>
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
      ) : puzzles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-600">
          Bu vazifada tayinlangan variantlar yo'q.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {puzzles.map((p) => (
            <div key={p.id} className="w-full px-3 py-2.5 text-left transition-colors hover:bg-slate-50">
              {(() => {
                const practiceAttemptsUsed =
                  typeof p.assignment.practiceAttemptsUsed === "number"
                    ? p.assignment.practiceAttemptsUsed
                    : null;
                const practiceLimit =
                  typeof p.assignment.practiceLimit === "number"
                    ? p.assignment.practiceLimit
                    : null;
                const isPracticeLimitReached =
                  practiceLimit !== null &&
                  practiceAttemptsUsed !== null &&
                  practiceAttemptsUsed >= practiceLimit;
                return (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <TruncatedText text={p.name} className="text-sm font-medium text-slate-900" />
                  {p.assignment ? (
                    <div className="mt-0.5 text-xs text-slate-500">
                      Rejim: {assignmentModeLabel(p.assignment.mode)}
                      {p.assignment.mode === "test" && practiceAttemptsUsed !== null ? (
                        <>
                          {" · "}Urinishlar: {practiceAttemptsUsed}
                          {practiceLimit !== null ? `/${practiceLimit}` : ""}
                        </>
                      ) : null}
                      {p.assignment.completedAt ? " · bajarildi" : ""}
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    title="O'rganish"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={p.assignment.mode !== "new"}
                    onClick={() => navigate(`/puzzle/${p.id}?mode=study`)}
                  >
                    <BookOpen className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Mashq"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={
                      p.assignment.mode !== "test" ||
                      isPracticeLimitReached
                    }
                    onClick={() => navigate(`/puzzle/${p.id}?mode=practice`)}
                  >
                    <Dumbbell className="h-4 w-4" />
                  </button>
                </div>
              </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
