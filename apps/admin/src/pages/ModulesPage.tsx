import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, TruncatedText } from "@shaxmatchi/ui";
import { adminDebutsApi, type Course, type Level, type Module } from "../api/adminDebutsApi";
import { AdminBreadcrumb } from "../components/AdminBreadcrumb";
import { debutsUi } from "../components/debuts/debutsUi";
import { DebutsPageHeader } from "../components/debuts/DebutsPageHeader";
import { InlineSpinner } from "../components/loading";
import { Plus, Check, X, Pencil, Trash2 } from "lucide-react";

export function ModulesPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [newName, setNewName] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingValue, setEditingValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const levelId = params.levelId;
  const courseId = params.courseId;
  if (!levelId || !courseId) return <div className="text-xs text-slate-600">Missing params</div>;
  const levelIdSafe: string = levelId;
  const courseIdSafe: string = courseId;

  const queryClient = useQueryClient();
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

  const createModuleMutation = useMutation({
    mutationFn: (name: string) => adminDebutsApi.createModule(levelIdSafe, courseIdSafe, name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminDebuts", "modules", levelIdSafe, courseIdSafe] });
      await queryClient.invalidateQueries({ queryKey: ["adminDebuts", "courses", levelIdSafe] });
      await queryClient.invalidateQueries({ queryKey: ["adminDebuts", "levels"] });
    },
  });
  const updateModuleMutation = useMutation({
    mutationFn: (input: { moduleId: string; name: string }) =>
      adminDebutsApi.updateModule(levelIdSafe, courseIdSafe, input.moduleId, input.name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminDebuts", "modules", levelIdSafe, courseIdSafe] });
    },
  });
  const deleteModuleMutation = useMutation({
    mutationFn: (moduleId: string) => adminDebutsApi.deleteModule(levelIdSafe, courseIdSafe, moduleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminDebuts", "modules", levelIdSafe, courseIdSafe] });
    },
  });

  const levels: Level[] = levelsQuery.data ?? [];
  const courses: Course[] = coursesQuery.data ?? [];
  const items: Module[] = modulesQuery.data ?? [];
  const levelName = levels.find((l) => l.id === levelIdSafe)?.name ?? "Debyut daraja";
  const courseName = courses.find((c) => c.id === courseIdSafe)?.name ?? "Kurs";
  const loading = levelsQuery.isLoading || coursesQuery.isLoading || modulesQuery.isLoading;
  const busy =
    createModuleMutation.isPending || updateModuleMutation.isPending || deleteModuleMutation.isPending;

  React.useEffect(() => {
    const err = modulesQuery.error ?? coursesQuery.error ?? levelsQuery.error;
    if (err) setError(err instanceof Error ? err.message : "Modullarni yuklab bo'lmadi");
  }, [modulesQuery.error, coursesQuery.error, levelsQuery.error]);

  async function create() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    try {
      await createModuleMutation.mutateAsync(name);
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Modulni yaratib bo'lmadi");
    }
  }

  async function saveRename() {
    if (!editingId) return;
    const name = editingValue.trim();
    if (!name) return;
    setError(null);
    try {
      await updateModuleMutation.mutateAsync({ moduleId: editingId, name });
      setEditingId(null);
      setEditingValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Modul nomini o'zgartirib bo'lmadi");
    }
  }

  async function remove(id: string) {
    if (!confirm("Modul va BARCHA vazifalar/pazllarni o'chirasizmi?")) return;
    setError(null);
    try {
      await deleteModuleMutation.mutateAsync(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Modulni o'chirib bo'lmadi");
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
          { label: courseName },
        ]}
      />
      <DebutsPageHeader
        title="Modullar"
        contextLabel="Kurs"
        contextValue={courseName}
        loading={loading}
        backTo={`/debuts/levels/${levelIdSafe}/courses`}
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
            placeholder="Yangi modul nomi"
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
            Modullar yuklanmoqda…
          </div>
        ) : items.length === 0 ? (
          <div className={debutsUi.empty}>Hali modullar yo'q.</div>
        ) : (
          <div className={debutsUi.listRows}>
            {items.map((m) => (
              <div
                key={m.id}
                role="button"
                tabIndex={busy ? -1 : 0}
                className={[debutsUi.row, debutsUi.rowHover, busy ? "" : "cursor-pointer"].join(" ")}
                onClick={() => {
                  if (busy) return;
                  navigate(`/debuts/levels/${levelIdSafe}/courses/${courseIdSafe}/modules/${m.id}/tasks`);
                }}
                onKeyDown={(e) => {
                  if (busy) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/debuts/levels/${levelIdSafe}/courses/${courseIdSafe}/modules/${m.id}/tasks`);
                  }
                }}
                aria-disabled={busy ? "true" : "false"}
              >
                <div className="min-w-0 flex-1">
                  <TruncatedText text={m.name} className="text-sm font-medium text-slate-900" />
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
                      setEditingId(m.id);
                      setEditingValue(m.name);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" className={debutsUi.dangerBtn} disabled={busy} title="O'chirish" onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void remove(m.id);
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
