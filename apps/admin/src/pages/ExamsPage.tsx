import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, TruncatedText } from "@shaxmatchi/ui";
import { Plus, Pencil, Trash2, GraduationCap } from "lucide-react";
import { adminExamsApi, type Exam } from "../api/adminExamsApi";
import { AdminBreadcrumb } from "../components/AdminBreadcrumb";
import { debutsUi } from "../components/debuts/debutsUi";
import { DebutsPageHeader } from "../components/debuts/DebutsPageHeader";
import { useConfirmDialog } from "../components/ConfirmDialog";
import { InlineSpinner } from "../components/loading";

export function ExamsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [error, setError] = React.useState<string | null>(null);

  const examsQuery = useQuery({
    queryKey: ["adminExams"],
    queryFn: adminExamsApi.list,
  });

  const deleteExamMutation = useMutation({
    mutationFn: (examId: string) => adminExamsApi.delete(examId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminExams"] });
    },
  });

  const exams: Exam[] = examsQuery.data ?? [];
  const busy = deleteExamMutation.isPending;

  React.useEffect(() => {
    if (examsQuery.error) {
      setError(examsQuery.error instanceof Error ? examsQuery.error.message : "Imtihonlarni yuklab bo'lmadi");
    }
  }, [examsQuery.error]);

  async function remove(id: string, name: string) {
    const ok = await confirm({
      title: "Imtihonni o'chirish",
      description: `"${name}" imtihonini va BARCHA tayinlovlarini o'chirasizmi?`,
      confirmLabel: "O'chirish",
      cancelLabel: "Bekor qilish",
      variant: "danger",
      requirePassword: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteExamMutation.mutateAsync(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Imtihonni o'chirib bo'lmadi");
    }
  }

  return (
    <div className={debutsUi.page}>
      <AdminBreadcrumb compact items={[{ label: "Boshqaruv paneli", to: "/" }, { label: "Imtihonlar" }]} />
      <DebutsPageHeader
        title="Imtihonlar"
        description="O'quvchilar uchun imtihonlar yaratish va tayinlash."
      />

      {error ? <div className={debutsUi.error}>{error}</div> : null}

      <div className="flex">
        <Button size="sm" onClick={() => navigate("/exams/new")} disabled={busy}>
          <Plus className="mr-1 h-4 w-4" /> Yangi imtihon
        </Button>
      </div>

      <div className={debutsUi.card}>
        {examsQuery.isLoading ? (
          <div className={debutsUi.loadingBox}>
            <InlineSpinner />
            Imtihonlar yuklanmoqda…
          </div>
        ) : exams.length === 0 ? (
          <div className={debutsUi.empty}>Hali imtihonlar yo'q.</div>
        ) : (
          <div className={debutsUi.listRows}>
            {exams.map((e) => (
              <div
                key={e.id}
                role="button"
                tabIndex={busy ? -1 : 0}
                className={[debutsUi.row, debutsUi.rowHover, busy ? "" : "cursor-pointer"].join(" ")}
                onClick={() => {
                  if (busy) return;
                  navigate(`/exams/${e.id}`);
                }}
                onKeyDown={(ev) => {
                  if (busy) return;
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    navigate(`/exams/${e.id}`);
                  }
                }}
                aria-disabled={busy ? "true" : "false"}
              >
                <div className="min-w-0 flex-1">
                  <TruncatedText text={e.name} className="text-sm font-medium text-slate-900" />
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span>⏱ {e.secondsPerMove}s/yurish</span>
                    <span>🔁 {e.attemptsAllowed} urinish</span>
                    <span>
                      <GraduationCap className="mr-0.5 inline h-3 w-3" />
                      {e.puzzleCount} pazl
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                  <button
                    type="button"
                    className={debutsUi.linkBtn}
                    disabled={busy}
                    title="Tahrirlash"
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      navigate(`/exams/${e.id}`);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={debutsUi.dangerBtn}
                    disabled={busy}
                    title="O'chirish"
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      void remove(e.id, e.name);
                    }}
                  >
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
