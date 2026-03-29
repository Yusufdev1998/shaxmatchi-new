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

export function DebutModulesPage() {
  const navigate = useNavigate();
  const params = useParams();
  const levelId = params.levelId;
  const courseId = params.courseId;
  if (!levelId || !courseId) return <div className="text-sm text-slate-600">Missing params</div>;

  const hierarchyQuery = useQuery({
    queryKey: ["studentDebuts", "hierarchy"],
    queryFn: studentDebutsApi.listHierarchy,
  });

  const level = hierarchyQuery.data?.find((l) => l.id === levelId);
  const course = level?.courses.find((c) => c.id === courseId);
  const levelName = level?.name ?? "Daraja";
  const courseName = course?.name ?? "Kurs";
  const loading = hierarchyQuery.isLoading;
  const error = hierarchyQuery.error;
  const modules = course?.modules ?? [];

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
            <BreadcrumbPage>{courseName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Modullar</h1>
        <p className="mt-1 text-sm text-slate-600">Kurs: {courseName}</p>
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
      ) : modules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-600">
          Bu kursda tayinlangan vazifalari bor modullar yo'q.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {modules.map((m) => (
            <button
              key={m.id}
              type="button"
              className="w-full px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
              onClick={() => navigate(`/debut/levels/${levelId}/courses/${courseId}/modules/${m.id}/tasks`)}
            >
              <div className="min-w-0">
                <TruncatedText text={m.name} className="text-sm font-medium text-slate-900" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
