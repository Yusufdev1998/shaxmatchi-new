import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, TruncatedText } from "@shaxmatchi/ui";
import { ChevronRight, ExternalLink } from "lucide-react";
import { AdminBreadcrumb } from "../../components/AdminBreadcrumb";
import { LoadingCard } from "../../components/loading";
import { adminStatsApi, type LearningPuzzleStatRow } from "../../api/adminStatsApi";
import { formatLearningDuration } from "../../lib/formatLearningDuration";

function taskPuzzlesPath(row: LearningPuzzleStatRow): string {
  return `/debuts/levels/${row.levelId}/courses/${row.courseId}/modules/${row.moduleId}/tasks/${row.taskId}/puzzles`;
}

function groupRowsByStudent(rows: LearningPuzzleStatRow[]): { studentId: string; login: string; items: LearningPuzzleStatRow[] }[] {
  const map = new Map<string, LearningPuzzleStatRow[]>();
  for (const r of rows) {
    const list = map.get(r.studentId) ?? [];
    list.push(r);
    map.set(r.studentId, list);
  }
  return [...map.entries()]
    .map(([studentId, items]) => ({
      studentId,
      login: items[0]?.studentLogin ?? studentId,
      items,
    }))
    .sort((a, b) => a.login.localeCompare(b.login, "uz"));
}

export function LearningTimeStatsPage() {
  const navigate = useNavigate();

  const learningQuery = useQuery({
    queryKey: ["adminStats", "learningPuzzles"],
    queryFn: adminStatsApi.listLearningPuzzles,
  });

  const rows = learningQuery.data ?? [];
  const groups = React.useMemo(() => groupRowsByStudent(rows), [rows]);

  const [openIds, setOpenIds] = React.useState<Set<string>>(() => new Set());

  const toggleStudent = React.useCallback((studentId: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }, []);

  return (
    <div className="space-y-4">
      <AdminBreadcrumb
        compact
        items={[
          { label: "Statistika", to: "/stats" },
          { label: "O‘rganish vaqti" },
        ]}
      />

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900">O‘rganish vaqti</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            O‘quvchini bosing — variantlar ochiladi. Har bir qatorda joy, variant, jami o‘rganish vaqti va tayinlangan
            sana.
          </p>
        </div>

        <div className="p-0">
          {learningQuery.isLoading ? (
            <div className="p-4">
              <LoadingCard title="Yuklanmoqda…" lines={3} compact />
            </div>
          ) : learningQuery.error ? (
            <div className="p-4 text-sm text-red-700">
              {learningQuery.error instanceof Error ? learningQuery.error.message : "Xatolik yuz berdi"}
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-600 sm:px-5">
              Hozircha o‘rganish tayinlovlari yo‘q yoki ma’lumot yo‘q.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium uppercase tracking-wide text-slate-600">
                    <th className="px-3 py-2.5 sm:px-4">O‘quvchi</th>
                    <th className="px-3 py-2.5 sm:px-4">Joy</th>
                    <th className="px-3 py-2.5 sm:px-4">Variant</th>
                    <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">Vaqt</th>
                    <th className="whitespace-nowrap px-3 py-2.5 sm:px-4">Tayinlangan</th>
                    <th className="px-3 py-2.5 sm:px-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groups.map(({ studentId, login, items }) => {
                    const expanded = openIds.has(studentId);
                    return (
                      <React.Fragment key={studentId}>
                        <tr className="bg-slate-100/90">
                          <td colSpan={6} className="px-0 py-0">
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-slate-200/80 sm:px-4"
                              onClick={() => toggleStudent(studentId)}
                              aria-expanded={expanded}
                            >
                              <ChevronRight
                                className={`h-4 w-4 shrink-0 text-slate-600 transition-transform ${expanded ? "rotate-90" : ""}`}
                                aria-hidden
                              />
                              <span className="font-semibold text-slate-900">{login}</span>
                              <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-normal text-slate-600 ring-1 ring-slate-200/80">
                                {items.length} ta variant
                              </span>
                            </button>
                          </td>
                        </tr>
                        {expanded
                          ? items.map((row) => (
                              <tr key={row.assignmentId} className="bg-white hover:bg-slate-50/80">
                                <td
                                  className="w-6 border-l-2 border-indigo-200 bg-indigo-50/30 px-1 py-2.5 sm:w-8"
                                  aria-hidden
                                />
                                <td className="max-w-[200px] px-3 py-2.5 align-top text-xs text-slate-600 sm:max-w-[280px] sm:px-4">
                                  <TruncatedText
                                    text={`${row.levelName} · ${row.courseName} · ${row.moduleName} · ${row.taskName}`}
                                    maxLines={3}
                                  />
                                </td>
                                <td className="max-w-[200px] px-3 py-2.5 align-top sm:px-4">
                                  <TruncatedText text={row.puzzleName} className="text-slate-700" maxLines={2} />
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs text-slate-700 sm:px-4">
                                  {formatLearningDuration(row.learningSecondsTotal)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 align-top text-xs text-slate-600 sm:px-4">
                                  {new Date(row.assignedAt).toLocaleString()}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5 align-top sm:px-4">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    className="h-8 w-8 p-0"
                                    title="Variantlar sahifasiga o‘tish"
                                    onClick={() => navigate(taskPuzzlesPath(row))}
                                  >
                                    <ExternalLink className="h-4 w-4" aria-hidden />
                                  </Button>
                                </td>
                              </tr>
                            ))
                          : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
