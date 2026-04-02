import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, TruncatedText } from "@shaxmatchi/ui";
import { adminDebutsApi, type Course, type Level } from "../api/adminDebutsApi";
import { AdminBreadcrumb } from "../components/AdminBreadcrumb";
import { debutsUi } from "../components/debuts/debutsUi";
import { DebutsPageHeader } from "../components/debuts/DebutsPageHeader";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { InlineSpinner } from "../components/loading";
import { Plus, Check, X, Pencil, Trash2 } from "lucide-react";

export function CoursesPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [newName, setNewName] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingValue, setEditingValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const levelId = params.levelId;
  if (!levelId) {
    return <div className="text-xs text-slate-600">Missing levelId</div>;
  }
  const levelIdSafe: string = levelId;
  const levelsQuery = useQuery({
    queryKey: ["adminDebuts", "levels"],
    queryFn: adminDebutsApi.listLevels,
  });
  const coursesQuery = useQuery({
    queryKey: ["adminDebuts", "courses", levelIdSafe],
    queryFn: () => adminDebutsApi.listCourses(levelIdSafe),
  });

  const createCourseMutation = useMutation({
    mutationFn: (name: string) => adminDebutsApi.createCourse(levelIdSafe, name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminDebuts", "courses", levelIdSafe] });
      await queryClient.invalidateQueries({ queryKey: ["adminDebuts", "levels"] });
    },
  });
  const updateCourseMutation = useMutation({
    mutationFn: (input: { courseId: string; name: string }) =>
      adminDebutsApi.updateCourse(levelIdSafe, input.courseId, input.name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminDebuts", "courses", levelIdSafe] });
      await queryClient.invalidateQueries({ queryKey: ["adminDebuts", "levels"] });
    },
  });
  const deleteCourseMutation = useMutation({
    mutationFn: (courseId: string) => adminDebutsApi.deleteCourse(levelIdSafe, courseId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminDebuts", "courses", levelIdSafe] });
      await queryClient.invalidateQueries({ queryKey: ["adminDebuts", "levels"] });
    },
  });

  const levels: Level[] = levelsQuery.data ?? [];
  const courses: Course[] = coursesQuery.data ?? [];
  const levelName = levels.find((l) => l.id === levelIdSafe)?.name ?? "Debyut daraja";
  const loading = levelsQuery.isLoading || coursesQuery.isLoading;
  const busy = createCourseMutation.isPending || updateCourseMutation.isPending || deleteCourseMutation.isPending;

  React.useEffect(() => {
    const err = coursesQuery.error ?? levelsQuery.error;
    if (err) setError(err instanceof Error ? err.message : "Kurslarni yuklab bo'lmadi");
  }, [coursesQuery.error, levelsQuery.error]);

  async function create() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    try {
      await createCourseMutation.mutateAsync(name);
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kursni yaratib bo'lmadi");
    }
  }

  async function saveRename() {
    if (!editingId) return;
    const name = editingValue.trim();
    if (!name) return;
    setError(null);
    try {
      await updateCourseMutation.mutateAsync({ courseId: editingId, name });
      setEditingId(null);
      setEditingValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kurs nomini o'zgartirib bo'lmadi");
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Kursni o'chirish",
      description: "Kurs va BARCHA modullar/vazifalar/pazllarni o'chirasizmi?",
      confirmLabel: "O'chirish",
      cancelLabel: "Bekor qilish",
      variant: "danger",
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteCourseMutation.mutateAsync(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kursni o'chirib bo'lmadi");
    }
  }

  return (
    <div className={debutsUi.page}>
      <AdminBreadcrumb
        compact
        items={[{ label: "Boshqaruv paneli", to: "/" }, { label: "Debyutlar", to: "/debuts" }, { label: levelName }]}
      />
      <DebutsPageHeader
        title="Kurslar"
        contextLabel="Daraja"
        contextValue={levelName}
        loading={loading}
        backTo="/debuts"
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
            placeholder="Yangi kurs nomi"
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
            Kurslar yuklanmoqda…
          </div>
        ) : courses.length === 0 ? (
          <div className={debutsUi.empty}>Hali kurslar yo'q.</div>
        ) : (
          <div className={debutsUi.listRows}>
            {courses.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={busy ? -1 : 0}
                className={[debutsUi.row, debutsUi.rowHover, busy ? "" : "cursor-pointer"].join(" ")}
                onClick={() => {
                  if (busy) return;
                  navigate(`/debuts/levels/${levelIdSafe}/courses/${c.id}/modules`);
                }}
                onKeyDown={(e) => {
                  if (busy) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/debuts/levels/${levelIdSafe}/courses/${c.id}/modules`);
                  }
                }}
                aria-disabled={busy ? "true" : "false"}
              >
                <div className="min-w-0 flex-1">
                  <TruncatedText text={c.name} className="text-sm font-medium text-slate-900" />
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
                      setEditingId(c.id);
                      setEditingValue(c.name);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" className={debutsUi.dangerBtn} disabled={busy} title="O'chirish" onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void remove(c.id);
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
