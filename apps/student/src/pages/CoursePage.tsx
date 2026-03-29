import * as React from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@shaxmatchi/ui";
import { Link, useNavigate, useParams } from "react-router-dom";

type CourseModule = {
  title: string;
  courses: { title: string; tasks: { id: string; title: string }[] }[];
};

const course41Modules: CourseModule[] = [
  {
    // Module title = page title (course/41)
    title: "3-2 razryad debyutlari",
    courses: [
      {
        title: "1. e2-e4 oqlar bilan",
        tasks: [
          { id: "four-knights", title: "To'rt otliq debyut" },
          { id: "italian", title: "Italyan partiyasi" },
          { id: "scotch", title: "Shotlandiya partiyasi" },
        ],
      },
      {
        title: "2. d2-d4 oqlar bilan",
        tasks: [
          { id: "london", title: "London tizimi" },
          { id: "qgambit", title: "Farzin gambiti" },
        ],
      },
    ],
  },
];

export function CoursePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [openCourses, setOpenCourses] = React.useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(course41Modules[0].courses.map((c) => [c.title, true]))
  );

  // This page is a UI clone of the StepChess course page (course/41) but uses local mock data.
  if (id !== "41") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="text-sm font-semibold">Kurs topilmadi</div>
        <div className="mt-1 text-sm text-slate-600">
          Faqat course/41 uchun demo mavjud.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Breadcrumbs / hierarchy */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/debut">Debyutlar</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>3-2 razryad debyutlari</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          3-2 razryad debyutlari
        </h1>
      </div>

      {/* Content (only "Mundarija") */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mt-2 space-y-3">
          {course41Modules[0].courses.map((course) => (
            <details
              key={course.title}
              open={openCourses[course.title] ?? true}
              onToggle={(e) => {
                const next = (e.currentTarget as HTMLDetailsElement).open;
                setOpenCourses((prev) => ({ ...prev, [course.title]: next }));
              }}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white"
            >
              <summary className="cursor-pointer list-none px-3 py-2 transition-colors hover:bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold">{course.title}</div>
                  <div className="shrink-0 text-xs text-slate-500">
                    {course.tasks.length} vazifa
                  </div>
                </div>
              </summary>
              <div className="border-t border-slate-200">
                <div className="divide-y divide-slate-100">
                  {course.tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
                      onClick={() => navigate(`/task/${task.id}`)}
                    >
                      {task.title}
                    </button>
                  ))}
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
