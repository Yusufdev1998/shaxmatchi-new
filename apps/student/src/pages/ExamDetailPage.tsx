import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@shaxmatchi/ui";
import { GraduationCap, Play } from "lucide-react";
import {
  studentExamsApi,
  type StudentExamAttemptStart,
  type StudentExamDetail,
} from "../api/studentExamsApi";

function formatLocal(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

function statusLabel(status: "in_progress" | "passed" | "failed") {
  if (status === "passed") return { text: "O'tdi", tone: "text-emerald-700" };
  if (status === "failed") return { text: "O'tmadi", tone: "text-red-700" };
  return { text: "Davom etmoqda", tone: "text-slate-600" };
}

export function ExamDetailPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);

  const examQuery = useQuery({
    queryKey: ["studentExam", examId],
    queryFn: () => studentExamsApi.get(examId!),
    enabled: !!examId,
  });

  const startMutation = useMutation({
    mutationFn: () => studentExamsApi.startAttempt(examId!),
    onSuccess: (data: StudentExamAttemptStart) => {
      // Park the attempt payload in the query cache so the take page can read it without a second call.
      queryClient.setQueryData(["studentExamAttempt", data.attemptId], data);
      navigate(`/exams/${examId}/take/${data.attemptId}`);
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : "Imtihonni boshlab bo'lmadi");
    },
  });

  if (!examId) return null;

  if (examQuery.isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        Yuklanmoqda…
      </div>
    );
  }
  if (examQuery.error) {
    return (
      <div className="space-y-2">
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {examQuery.error instanceof Error ? examQuery.error.message : "Imtihonni yuklab bo'lmadi"}
        </div>
        <Button asChild variant="secondary">
          <Link to="/exams">Orqaga</Link>
        </Button>
      </div>
    );
  }
  const exam: StudentExamDetail | undefined = examQuery.data;
  if (!exam) return null;

  const remaining = Math.max(0, exam.attemptsAllowed - exam.attemptsUsed);
  const exhausted = remaining === 0;

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-slate-600" />
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{exam.name}</h1>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Har imtihonda {exam.puzzleCount} ta tasodifiy pazl, har yurish uchun {exam.secondsPerMove} soniya.
          Bitta noto'g'ri yurish imtihonni to'xtatadi.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Yurishga vaqt" value={`${exam.secondsPerMove}s`} />
          <Stat label="Pazllar" value={String(exam.puzzleCount)} />
          <Stat label="Urinishlar" value={`${remaining}/${exam.attemptsAllowed}`} tone={exhausted ? "text-red-600" : undefined} />
          <Stat label="Tayinlangan" value={new Date(exam.assignedAt).toLocaleDateString()} />
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="mt-4">
          <Button
            className="w-full sm:w-auto"
            disabled={exhausted || startMutation.isPending}
            onClick={() => startMutation.mutate()}
          >
            {startMutation.isPending ? (
              <span>Boshlanmoqda…</span>
            ) : (
              <>
                <Play className="mr-1 h-4 w-4" />
                {exhausted ? "Urinishlar tugagan" : "Imtihonni boshlash"}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="text-sm font-semibold">Urinish tarixi</div>
        {exam.attempts.length === 0 ? (
          <div className="mt-2 text-xs text-slate-500">Hali urinishlar yo'q.</div>
        ) : (
          <div className="mt-2 divide-y divide-slate-100">
            {exam.attempts.map((a) => {
              const lbl = statusLabel(a.status);
              return (
                <div key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <div className={`font-medium ${lbl.tone}`}>{lbl.text}</div>
                    <div className="text-xs text-slate-500">Boshlandi: {formatLocal(a.startedAt)}</div>
                  </div>
                  <div className="shrink-0 text-xs text-slate-500">
                    Tugadi: {formatLocal(a.completedAt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <Button asChild variant="secondary">
          <Link to="/exams">Orqaga</Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-sm font-semibold ${tone ?? "text-slate-900"}`}>{value}</div>
    </div>
  );
}
