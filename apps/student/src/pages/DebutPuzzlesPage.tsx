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
import { studentDebutsApi } from "../api/studentDebutsApi";

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
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Pazllar</h1>
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
          Bu vazifada tayinlangan pazllar yo'q.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {puzzles.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
              onClick={() => navigate(`/puzzle/${p.id}`)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <TruncatedText text={p.name} className="text-sm font-medium text-slate-900" />
                  {p.assignment ? (
                    <div className="mt-0.5 text-xs text-slate-500">
                      Rejim: {p.assignment.mode}
                      {p.assignment.completedAt ? " · bajarildi" : ""}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0">
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700">o'ynash</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
