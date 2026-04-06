import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, TruncatedText } from "@shaxmatchi/ui";
import { adminDebutsApi, type Level } from "../api/adminDebutsApi";
import { AdminBreadcrumb } from "../components/AdminBreadcrumb";
import { debutsUi } from "../components/debuts/debutsUi";
import { DebutsPageHeader } from "../components/debuts/DebutsPageHeader";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { InlineSpinner } from "../components/loading";
import { Plus, Check, X, Pencil, Trash2 } from "lucide-react";

export function DebutLevelsPage() {
  const navigate = useNavigate();
  const [newName, setNewName] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingValue, setEditingValue] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const levelsQuery = useQuery({
    queryKey: ["adminDebuts", "levels"],
    queryFn: adminDebutsApi.listLevels,
  });

  const createLevelMutation = useMutation({
    mutationFn: (name: string) => adminDebutsApi.createLevel(name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminDebuts", "levels"] });
    },
  });

  const updateLevelMutation = useMutation({
    mutationFn: (input: { levelId: string; name: string }) => adminDebutsApi.updateLevel(input.levelId, input.name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminDebuts", "levels"] });
    },
  });

  const deleteLevelMutation = useMutation({
    mutationFn: (levelId: string) => adminDebutsApi.deleteLevel(levelId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminDebuts", "levels"] });
    },
  });

  const levels: Level[] = levelsQuery.data ?? [];
  const busy =
    createLevelMutation.isPending || updateLevelMutation.isPending || deleteLevelMutation.isPending;

  React.useEffect(() => {
    setLoading(levelsQuery.isLoading);
    if (levelsQuery.error) {
      setError(levelsQuery.error instanceof Error ? levelsQuery.error.message : "Debyut darajalarini yuklab bo'lmadi");
    }
  }, [levelsQuery.isLoading, levelsQuery.error]);

  async function create() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    try {
      await createLevelMutation.mutateAsync(name);
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Darajani yaratib bo'lmadi");
    }
  }

  async function saveRename() {
    if (!editingId) return;
    const name = editingValue.trim();
    if (!name) return;
    setError(null);
    try {
      await updateLevelMutation.mutateAsync({ levelId: editingId, name });
      setEditingId(null);
      setEditingValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Daraja nomini o'zgartirib bo'lmadi");
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Debyut darajasini o'chirish",
      description: "Debyut darajasi va BARCHA kurslar/modullar/vazifalar/pazllarni o'chirasizmi?",
      confirmLabel: "O'chirish",
      cancelLabel: "Bekor qilish",
      variant: "danger",
      requirePassword: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteLevelMutation.mutateAsync(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Darajani o'chirib bo'lmadi");
    }
  }

  return (
    <div className={debutsUi.page}>
      <AdminBreadcrumb compact items={[{ label: "Boshqaruv paneli", to: "/" }, { label: "Debyutlar" }]} />
      <DebutsPageHeader title="Debyut darajalari" description="Kurslarini boshqarish uchun darajani oching." />

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
            placeholder="Yangi daraja nomi"
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
            Darajalar yuklanmoqda…
          </div>
        ) : levels.length === 0 ? (
          <div className={debutsUi.empty}>Hali debyut darajalari yo'q.</div>
        ) : (
          <div className={debutsUi.listRows}>
            {levels.map((l) => (
              <div
                key={l.id}
                role="button"
                tabIndex={busy ? -1 : 0}
                className={[debutsUi.row, debutsUi.rowHover, busy ? "" : "cursor-pointer"].join(" ")}
                onClick={() => {
                  if (busy) return;
                  navigate(`/debuts/levels/${l.id}/courses`);
                }}
                onKeyDown={(e) => {
                  if (busy) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/debuts/levels/${l.id}/courses`);
                  }
                }}
                aria-disabled={busy ? "true" : "false"}
              >
                <div className="min-w-0 flex-1">
                  <TruncatedText text={l.name} className="text-sm font-medium text-slate-900" />
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                  <button type="button" className={debutsUi.linkBtn} disabled={busy} title="Tahrirlash" onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setEditingId(l.id);
                    setEditingValue(l.name);
                  }}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" className={debutsUi.dangerBtn} disabled={busy} title="O'chirish" onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void remove(l.id);
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
