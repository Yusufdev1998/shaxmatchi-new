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

export function DebutCoursesPage() {
  const navigate = useNavigate();
  const params = useParams();
  const levelId = params.levelId;
  if (!levelId) return <div className="text-sm text-slate-600">Missing levelId</div>;

  const hierarchyQuery = useQuery({
    queryKey: ["studentDebuts", "hierarchy"],
    queryFn: studentDebutsApi.listHierarchy,
  });

  const level = hierarchyQuery.data?.find((l) => l.id === levelId);
  const levelName = level?.name ?? "Daraja";
  const loading = hierarchyQuery.isLoading;
  const error = hierarchyQuery.error;
  const courses = level?.courses ?? [];

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
            <BreadcrumbPage>{levelName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Kurslar</h1>
        <p className="mt-1 text-sm text-slate-600">Daraja: {levelName}</p>
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
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-600">
          Bu darajada tayinlangan vazifalari bor kurslar yo'q.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {courses.map((c) => (
            <button
              key={c.id}
              type="button"
              className="w-full px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
              onClick={() => navigate(`/debut/levels/${levelId}/courses/${c.id}/modules`)}
            >
              <div className="min-w-0">
                <TruncatedText text={c.name} className="text-sm font-medium text-slate-900" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
