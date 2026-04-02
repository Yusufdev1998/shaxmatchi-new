import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, TruncatedText } from "@shaxmatchi/ui";
import { adminDebutsApi, type Course, type Level, type Module, type Task } from "../api/adminDebutsApi";
import { AdminBreadcrumb } from "../components/AdminBreadcrumb";
import { debutsUi } from "../components/debuts/debutsUi";
import { DebutsPageHeader } from "../components/debuts/DebutsPageHeader";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { InlineSpinner } from "../components/loading";
import { Plus, Check, X, Pencil, Trash2 } from "lucide-react";

export function TasksPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [newName, setNewName] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingValue, setEditingValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const levelId = params.levelId;
  const courseId = params.courseId;
  const moduleId = params.moduleId;
  if (!levelId || !courseId || !moduleId) return <div className="text-xs text-slate-600">Missing params</div>;
  const levelIdSafe: string = levelId;
  const courseIdSafe: string = courseId;
  const moduleIdSafe: string = moduleId;
  const levelsQuery = useQuery({
    queryKey: ["adminDebuts", "levels"],
    queryFn: adminDebutsApi.listLevels,
  });
  const coursesQuery = useQuery({
    queryKey: ["adminDebuts", "courses", levelIdSafe],
    queryFn: () => adminDebutsApi.listCourses(levelIdSafe),
  });
  const modulesQuery = useQuery({
    queryKey: ["adminDebuts", "modules", levelIdSafe, courseIdSafe],
    queryFn: () => adminDebutsApi.listModules(levelIdSafe, courseIdSafe),
  });
  const tasksQuery = useQuery({
    queryKey: ["adminDebuts", "tasks", levelIdSafe, courseIdSafe, moduleIdSafe],
    queryFn: () => adminDebutsApi.listTasks(levelIdSafe, courseIdSafe, moduleIdSafe),
  });

  const createTaskMutation = useMutation({
    mutationFn: (name: string) => adminDebutsApi.createTask(levelIdSafe, courseIdSafe, moduleIdSafe, name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["adminDebuts", "tasks", levelIdSafe, courseIdSafe, moduleIdSafe],
      });
    },
  });
  const updateTaskMutation = useMutation({
    mutationFn: (input: { taskId: string; name: string }) =>
      adminDebutsApi.updateTask(levelIdSafe, courseIdSafe, moduleIdSafe, input.taskId, input.name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["adminDebuts", "tasks", levelIdSafe, courseIdSafe, moduleIdSafe],
      });
    },
  });
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => adminDebutsApi.deleteTask(levelIdSafe, courseIdSafe, moduleIdSafe, taskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["adminDebuts", "tasks", levelIdSafe, courseIdSafe, moduleIdSafe],
      });
    },
  });

  const levels: Level[] = levelsQuery.data ?? [];
  const courses: Course[] = coursesQuery.data ?? [];
  const modules: Module[] = modulesQuery.data ?? [];
  const items: Task[] = tasksQuery.data ?? [];
  const levelName = levels.find((l) => l.id === levelIdSafe)?.name ?? "Debyut daraja";
  const courseName = courses.find((c) => c.id === courseIdSafe)?.name ?? "Kurs";
  const moduleName = modules.find((m) => m.id === moduleIdSafe)?.name ?? "Modul";
  const loading =
    levelsQuery.isLoading || coursesQuery.isLoading || modulesQuery.isLoading || tasksQuery.isLoading;
  const busy = createTaskMutation.isPending || updateTaskMutation.isPending || deleteTaskMutation.isPending;

  React.useEffect(() => {
    const err = tasksQuery.error ?? modulesQuery.error ?? coursesQuery.error ?? levelsQuery.error;
    if (err) setError(err instanceof Error ? err.message : "Vazifalarni yuklab bo'lmadi");
  }, [tasksQuery.error, modulesQuery.error, coursesQuery.error, levelsQuery.error]);

  async function create() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    try {
      await createTaskMutation.mutateAsync(name);
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vazifani yaratib bo'lmadi");
    }
  }

  async function saveRename() {
    if (!editingId) return;
    const name = editingValue.trim();
    if (!name) return;
    setError(null);
    try {
      await updateTaskMutation.mutateAsync({ taskId: editingId, name });
      setEditingId(null);
      setEditingValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vazifa nomini o'zgartirib bo'lmadi");
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Vazifani o'chirish",
      description: "Vazifa va BARCHA pazllarni o'chirasizmi?",
      confirmLabel: "O'chirish",
      cancelLabel: "Bekor qilish",
      variant: "danger",
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteTaskMutation.mutateAsync(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Vazifani o'chirib bo'lmadi");
    }
  }

  return (
    <div className={debutsUi.page}>
      <AdminBreadcrumb
        compact
        items={[
          { label: "Boshqaruv paneli", to: "/" },
          { label: "Debyutlar", to: "/debuts" },
          { label: levelName, to: `/debuts/levels/${levelIdSafe}/courses` },
          { label: courseName, to: `/debuts/levels/${levelIdSafe}/courses/${courseIdSafe}/modules` },
          { label: moduleName },
        ]}
      />
      <DebutsPageHeader
        title="Vazifalar"
        contextLabel="Modul"
        contextValue={moduleName}
        loading={loading}
        backTo={`/debuts/levels/${levelIdSafe}/courses/${courseIdSafe}/modules`}
      />

      {error ? <div className={debutsUi.error}>{error}</div> : null}

      <div className={debutsUi.card}>
        <form
          className={debutsUi.addRow}
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <input
            className={debutsUi.input}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Yangi vazifa nomi"
            disabled={busy}
          />
          <Button type="submit" size="sm" disabled={busy}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        {editingId ? (
          <div className={debutsUi.renameRow}>
            <label className="min-w-[120px] flex-1 space-y-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Nomini o'zgartirish</span>
              <input
                className={debutsUi.input}
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                disabled={busy}
              />
            </label>
            <Button size="sm" disabled={busy} title="Saqlash" onClick={() => void saveRename()}>
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setEditingId(null);
                setEditingValue("");
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null}

        {loading ? (
          <div className={debutsUi.loadingBox}>
            <InlineSpinner />
            Vazifalar yuklanmoqda…
          </div>
        ) : items.length === 0 ? (
          <div className={debutsUi.empty}>Hali vazifalar yo'q.</div>
        ) : (
          <div className={debutsUi.listRows}>
            {items.map((t) => (
              <div
                key={t.id}
                role="button"
                tabIndex={busy ? -1 : 0}
                className={[debutsUi.row, debutsUi.rowHover, busy ? "" : "cursor-pointer"].join(" ")}
                onClick={() => {
                  if (busy) return;
                  navigate(`/debuts/levels/${levelIdSafe}/courses/${courseIdSafe}/modules/${moduleIdSafe}/tasks/${t.id}/puzzles`);
                }}
                onKeyDown={(e) => {
                  if (busy) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/debuts/levels/${levelIdSafe}/courses/${courseIdSafe}/modules/${moduleIdSafe}/tasks/${t.id}/puzzles`);
                  }
                }}
                aria-disabled={busy ? "true" : "false"}
              >
                <div className="min-w-0 flex-1">
                  <TruncatedText text={t.name} className="text-sm font-medium text-slate-900" />
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                  <button
                    type="button"
                    className={debutsUi.linkBtn}
                    disabled={busy}
                    title="Tahrirlash"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingId(t.id);
                      setEditingValue(t.name);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" className={debutsUi.dangerBtn} disabled={busy} title="O'chirish" onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void remove(t.id);
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDialog}
    </div>
  );
}
