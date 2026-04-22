import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, TruncatedText } from "@shaxmatchi/ui";
import { Check, Trash2, Search, UserPlus, X } from "lucide-react";
import { adminExamsApi, type ExamAssignment, type ExamInput } from "../api/adminExamsApi";
import { adminDebutsApi, type TaskWithPath } from "../api/adminDebutsApi";
import { adminUsersApi, type Student } from "../api/adminUsersApi";
import { AdminBreadcrumb } from "../components/AdminBreadcrumb";
import { debutsUi } from "../components/debuts/debutsUi";
import { DebutsPageHeader } from "../components/debuts/DebutsPageHeader";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { InlineSpinner } from "../components/loading";

const DEFAULT_FORM: ExamInput = {
  name: "",
  secondsPerMove: 15,
  attemptsAllowed: 3,
  puzzleCount: 5,
  taskIds: [],
};

export function ExamEditPage() {
  const { examId } = useParams<{ examId: string }>();
  const isNew = !examId || examId === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const [form, setForm] = React.useState<ExamInput>(DEFAULT_FORM);
  const [taskSearch, setTaskSearch] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<string | null>(null);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [assignSearch, setAssignSearch] = React.useState("");
  const [assignSelected, setAssignSelected] = React.useState<Set<string>>(new Set());
  const [assignError, setAssignError] = React.useState<string | null>(null);

  const examQuery = useQuery({
    queryKey: ["adminExam", examId],
    queryFn: () => adminExamsApi.get(examId!),
    enabled: !isNew,
  });

  const tasksQuery = useQuery({
    queryKey: ["adminDebuts", "allTasks"],
    queryFn: adminDebutsApi.listAllTasks,
  });

  const studentsQuery = useQuery({
    queryKey: ["adminUsers", "students"],
    queryFn: adminUsersApi.listStudents,
    enabled: assignOpen,
  });

  const assignmentsQuery = useQuery({
    queryKey: ["adminExam", "assignments", examId],
    queryFn: () => adminExamsApi.listAssignments(examId!),
    enabled: !isNew,
  });

  React.useEffect(() => {
    if (isNew) {
      setForm(DEFAULT_FORM);
      return;
    }
    if (examQuery.data) {
      setForm({
        name: examQuery.data.name,
        secondsPerMove: examQuery.data.secondsPerMove,
        attemptsAllowed: examQuery.data.attemptsAllowed,
        puzzleCount: examQuery.data.puzzleCount,
        taskIds: examQuery.data.taskIds ?? [],
      });
    }
  }, [isNew, examQuery.data]);

  const createMutation = useMutation({
    mutationFn: (input: ExamInput) => adminExamsApi.create(input),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["adminExams"] });
      navigate(`/exams/${created.id}`, { replace: true });
    },
  });
  const updateMutation = useMutation({
    mutationFn: (input: ExamInput) => adminExamsApi.update(examId!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminExams"] });
      await queryClient.invalidateQueries({ queryKey: ["adminExam", examId] });
    },
  });
  const assignMutation = useMutation({
    mutationFn: (studentIds: string[]) => adminExamsApi.assign(examId!, studentIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminExam", "assignments", examId] });
    },
  });
  const unassignMutation = useMutation({
    mutationFn: (assignmentId: string) => adminExamsApi.unassign(examId!, assignmentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminExam", "assignments", examId] });
    },
  });

  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    assignMutation.isPending ||
    unassignMutation.isPending;

  const tasks: TaskWithPath[] = tasksQuery.data ?? [];
  const selectedTaskIdSet = React.useMemo(() => new Set(form.taskIds), [form.taskIds]);
  const filteredTasks = React.useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(
      (t) =>
        t.taskName.toLowerCase().includes(q) ||
        t.moduleName.toLowerCase().includes(q) ||
        t.courseName.toLowerCase().includes(q) ||
        t.levelName.toLowerCase().includes(q),
    );
  }, [tasks, taskSearch]);
  const selectedTasks = React.useMemo(
    () => tasks.filter((t) => selectedTaskIdSet.has(t.taskId)),
    [tasks, selectedTaskIdSet],
  );

  function toggleTask(taskId: string) {
    setForm((f) => {
      const next = new Set(f.taskIds);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return { ...f, taskIds: Array.from(next) };
    });
  }

  async function save() {
    setError(null);
    setSaved(null);
    const name = form.name.trim();
    if (!name) {
      setError("Imtihon nomi kerak.");
      return;
    }
    if (form.taskIds.length === 0) {
      setError("Kamida bitta vazifa tanlang.");
      return;
    }
    if (form.secondsPerMove < 1 || form.attemptsAllowed < 1 || form.puzzleCount < 1) {
      setError("Barcha raqamlar 1 yoki undan katta bo'lishi kerak.");
      return;
    }
    try {
      const payload = { ...form, name };
      if (isNew) await createMutation.mutateAsync(payload);
      else {
        await updateMutation.mutateAsync(payload);
        setSaved("Saqlandi");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    }
  }

  const assignments: ExamAssignment[] = assignmentsQuery.data ?? [];
  const assignedStudentIds = React.useMemo(
    () => new Set(assignments.map((a) => a.studentId)),
    [assignments],
  );
  const students: Student[] = studentsQuery.data ?? [];
  const filteredStudents = React.useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.login.toLowerCase().includes(q));
  }, [students, assignSearch]);

  function toggleAssignSelection(studentId: string) {
    setAssignSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  async function submitAssign() {
    setAssignError(null);
    if (assignSelected.size === 0) {
      setAssignError("Kamida bitta o'quvchi tanlang.");
      return;
    }
    try {
      await assignMutation.mutateAsync(Array.from(assignSelected));
      setAssignOpen(false);
      setAssignSelected(new Set());
      setAssignSearch("");
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : "Tayinlab bo'lmadi");
    }
  }

  async function unassign(assignmentId: string, studentLogin: string) {
    const ok = await confirm({
      title: "Tayinlovni bekor qilish",
      description: `${studentLogin} uchun imtihonni bekor qilasizmi?`,
      confirmLabel: "Bekor qilish",
      cancelLabel: "Yopish",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await unassignMutation.mutateAsync(assignmentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bekor qilib bo'lmadi");
    }
  }

  return (
    <div className={debutsUi.page}>
      <AdminBreadcrumb
        compact
        items={[
          { label: "Boshqaruv paneli", to: "/" },
          { label: "Imtihonlar", to: "/exams" },
          { label: isNew ? "Yangi" : form.name || "Imtihon" },
        ]}
      />
      <DebutsPageHeader
        title={isNew ? "Yangi imtihon" : "Imtihonni tahrirlash"}
        description="Nomini, parametrlarni va vazifalarni sozlang."
        backTo="/exams"
      />

      {error ? <div className={debutsUi.error}>{error}</div> : null}
      {saved ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {saved}
        </div>
      ) : null}

      <div className={debutsUi.card}>
        <div className={debutsUi.formCardPad}>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">Imtihon nomi</span>
            <input
              className={debutsUi.input}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Masalan: Queen's Gambit sinov"
              disabled={busy}
            />
          </label>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-slate-700">Har yurishga (sekund)</span>
              <input
                type="number"
                min={1}
                max={3600}
                className={debutsUi.input}
                value={form.secondsPerMove}
                onChange={(e) =>
                  setForm((f) => ({ ...f, secondsPerMove: Math.max(1, Math.round(Number(e.target.value) || 0)) }))
                }
                disabled={busy}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-slate-700">Urinishlar soni</span>
              <input
                type="number"
                min={1}
                max={100}
                className={debutsUi.input}
                value={form.attemptsAllowed}
                onChange={(e) =>
                  setForm((f) => ({ ...f, attemptsAllowed: Math.max(1, Math.round(Number(e.target.value) || 0)) }))
                }
                disabled={busy}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-slate-700">Pazllar soni</span>
              <input
                type="number"
                min={1}
                max={100}
                className={debutsUi.input}
                value={form.puzzleCount}
                onChange={(e) =>
                  setForm((f) => ({ ...f, puzzleCount: Math.max(1, Math.round(Number(e.target.value) || 0)) }))
                }
                disabled={busy}
              />
            </label>
          </div>

          <div className="pt-2">
            <div className="mb-1 text-xs font-medium text-slate-700">
              Vazifalar ({form.taskIds.length} tanlangan)
            </div>
            {selectedTasks.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1">
                {selectedTasks.map((t) => (
                  <span
                    key={t.taskId}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                  >
                    <TruncatedText text={t.taskName} className="max-w-[10rem]" />
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => toggleTask(t.taskId)}
                      disabled={busy}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className={`${debutsUi.input} pl-7`}
                placeholder="Vazifalar bo'yicha qidirish…"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
              {tasksQuery.isLoading ? (
                <div className={debutsUi.loadingBox}>
                  <InlineSpinner />
                  Yuklanmoqda…
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className={debutsUi.empty}>Vazifa topilmadi.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filteredTasks.map((t) => {
                    const selected = selectedTaskIdSet.has(t.taskId);
                    return (
                      <li key={t.taskId}>
                        <label className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleTask(t.taskId)}
                            disabled={busy}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="min-w-0 flex-1">
                            <TruncatedText text={t.taskName} className="text-sm font-medium text-slate-900" />
                            <div className="truncate text-xs text-slate-500">
                              {t.levelName} › {t.courseName} › {t.moduleName}
                            </div>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={() => void save()} disabled={busy}>
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <InlineSpinner />
                  Saqlanmoqda…
                </span>
              ) : (
                <>
                  <Check className="mr-1 h-4 w-4" /> {isNew ? "Yaratish" : "Saqlash"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {!isNew ? (
        <div className={debutsUi.card}>
          <div className="flex items-center justify-between border-b border-slate-100 p-2.5">
            <div className="text-sm font-semibold">Tayinlangan o'quvchilar ({assignments.length})</div>
            <Button
              size="sm"
              onClick={() => {
                setAssignError(null);
                setAssignSearch("");
                setAssignSelected(new Set());
                setAssignOpen(true);
              }}
              disabled={busy}
            >
              <UserPlus className="mr-1 h-4 w-4" /> Tayinlash
            </Button>
          </div>
          {assignmentsQuery.isLoading ? (
            <div className={debutsUi.loadingBox}>
              <InlineSpinner />
              Yuklanmoqda…
            </div>
          ) : assignments.length === 0 ? (
            <div className={debutsUi.empty}>Hali hech kimga tayinlanmagan.</div>
          ) : (
            <div className={debutsUi.listRows}>
              {assignments.map((a) => (
                <div key={a.id} className={debutsUi.row}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <TruncatedText text={a.studentLogin} className="text-sm font-medium text-slate-900" />
                      {a.lastResult === "passed" ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          Oxirgi: O'tdi
                        </span>
                      ) : a.lastResult === "failed" ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                          Oxirgi: O'tmadi
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span>Urinishlar: {a.attemptsUsed} / {form.attemptsAllowed}</span>
                      <span className="text-emerald-700">✓ {a.passed}</span>
                      <span className="text-red-700">✗ {a.failed}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={debutsUi.dangerBtn}
                    title="Bekor qilish"
                    disabled={busy}
                    onClick={() => void unassign(a.id, a.studentLogin)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {assignOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3"
          onMouseDown={() => !busy && setAssignOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold">O'quvchilarni tanlash</div>
            <div className="mt-1 text-sm text-slate-600">
              Imtihon tayinlanadigan o'quvchilarni belgilang.
            </div>
            {assignError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                {assignError}
              </div>
            ) : null}
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                className={`${debutsUi.input} pl-7`}
                placeholder="Login bo'yicha qidirish…"
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
              />
            </div>
            <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200">
              {studentsQuery.isLoading ? (
                <div className={debutsUi.loadingBox}>
                  <InlineSpinner />
                  Yuklanmoqda…
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className={debutsUi.empty}>O'quvchilar topilmadi.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filteredStudents.map((s) => {
                    const alreadyAssigned = assignedStudentIds.has(s.id);
                    return (
                      <li key={s.id}>
                        <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={assignSelected.has(s.id)}
                            onChange={() => toggleAssignSelection(s.id)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="min-w-0 flex-1">
                            <TruncatedText text={s.login} className="text-sm font-medium text-slate-900" />
                            {alreadyAssigned ? (
                              <div className="text-xs text-amber-600">Allaqachon tayinlangan — urinishlar nol'ga tushiriladi</div>
                            ) : null}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setAssignOpen(false)}
                disabled={busy}
              >
                Yopish
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void submitAssign()}
                disabled={busy || assignSelected.size === 0}
              >
                {assignMutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <InlineSpinner />
                    Tayinlanmoqda…
                  </span>
                ) : (
                  `Tayinlash (${assignSelected.size})`
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDialog}
    </div>
  );
}
