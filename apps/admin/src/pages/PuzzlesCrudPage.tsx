import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, TruncatedText } from "@shaxmatchi/ui";
import { Chess } from "chess.js";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import {
  adminDebutsApi,
  type PuzzleAssignmentMode,
  type Puzzle,
  type PuzzleMove,
} from "../api/adminDebutsApi";
import { adminUsersApi, type Student } from "../api/adminUsersApi";
import { Plus, Check, X, Pencil, Trash2, ExternalLink, UserPlus, UserMinus } from "lucide-react";
import { AdminBreadcrumb } from "../components/AdminBreadcrumb";
import { debutsUi } from "../components/debuts/debutsUi";
import { DebutsPageHeader } from "../components/debuts/DebutsPageHeader";
import { InlineSpinner, LoadingCard } from "../components/loading";

const quillModules = {
  toolbar: [
    ["bold", "italic", "underline"],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
    ["clean"],
  ],
};

// Quill uses a single "list" format with values "ordered" | "bullet".
// Including "bullet" here causes: "Cannot register 'bullet' specified in formats config".
const quillFormats = [
  "bold",
  "italic",
  "underline",
  "color",
  "background",
  "list",
  "link",
];

function formatMoveNumber(idx: number) {
  const moveNo = Math.floor(idx / 2) + 1;
  const isWhite = idx % 2 === 0;
  return isWhite ? `${moveNo}.` : `${moveNo}...`;
}

function assignmentModeLabel(mode: PuzzleAssignmentMode): string {
  return mode === "test" ? "mashq" : "o'rganish";
}

function pgnToSanMovesSafe(pgn: string): string[] {
  try {
    const chess = new Chess();
    // chess.js may return false instead of throwing, so we force fallback.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok =
      (chess as any).loadPgn?.(pgn, { strict: true }) ??
      (chess as any).load_pgn?.(pgn, { strict: true });
    if (ok === false) throw new Error("Invalid PGN");
    return chess.history();
  } catch {
    // Fallback: very naive extraction of SAN-like tokens.
    return pgn
      .replace(/\r\n/g, "\n")
      .replace(/\[[^\]]*\]/g, " ") // headers
      .replace(/;[^\n]*/g, " ") // semicolon comments
      .replace(/\{[^}]*\}/g, " ") // braces comments
      .replace(/\([^)]*\)/g, " ") // simple variations
      .replace(/\$[0-9]+/g, " ") // NAGs
      .replace(/\d+\.(\.\.\.)?/g, " ")
      .replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
  }
}

function parsePgnToMoves(pgnText: string): {
  moves: PuzzleMove[];
  normalizedPgn: string;
} {
  const input = pgnText.trim();
  if (!input) return { moves: [], normalizedPgn: "" };

  const sanMoves = pgnToSanMovesSafe(input);
  if (sanMoves.length === 0) {
    throw new Error("PGNni tahlil qilib bo'lmadi. To'g'ri PGN (SAN yurishlar) joylashtiring.");
  }

  // Best-effort normalized PGN (not required for saving).
  let normalizedPgn = "";
  try {
    const g = new Chess();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyG = g as any;
    const ok =
      anyG.loadPgn?.(input, { sloppy: true }) ??
      anyG.load_pgn?.(input, { sloppy: true });
    if (ok) normalizedPgn = g.pgn();
  } catch {
    normalizedPgn = "";
  }

  return {
    moves: sanMoves.map((san) => ({ san, explanation: "" })),
    normalizedPgn,
  };
}

export function PuzzlesCrudPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [newName, setNewName] = React.useState("");
  const [newPgn, setNewPgn] = React.useState("");
  const [newMoves, setNewMoves] = React.useState<PuzzleMove[]>([]);
  const [newPgnNormalized, setNewPgnNormalized] = React.useState<string>("");
  const [pgnError, setPgnError] = React.useState<string | null>(null);
  const [newMoveDialogIdx, setNewMoveDialogIdx] = React.useState<number | null>(
    null,
  );
  const [newMoveDialogValue, setNewMoveDialogValue] = React.useState("");
  const [editingPuzzleId, setEditingPuzzleId] = React.useState<string | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  // Assign puzzle → student
  const [assignOpenForPuzzleId, setAssignOpenForPuzzleId] = React.useState<
    string | null
  >(null);
  const [assignStudentId, setAssignStudentId] = React.useState<string>("");
  const [assignMode, setAssignMode] =
    React.useState<PuzzleAssignmentMode>("new");
  const [assignPracticeLimit, setAssignPracticeLimit] =
    React.useState<string>("");
  const [assignError, setAssignError] = React.useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = React.useState<string | null>(null);
  const queryClient = useQueryClient();

  const levelId = params.levelId;
  const courseId = params.courseId;
  const moduleId = params.moduleId;
  const taskId = params.taskId;
  if (!levelId || !courseId || !moduleId || !taskId)
    return <div className="text-sm text-slate-600">Missing params</div>;
  const levelIdSafe: string = levelId;
  const courseIdSafe: string = courseId;
  const moduleIdSafe: string = moduleId;
  const taskIdSafe: string = taskId;

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
    queryFn: () =>
      adminDebutsApi.listTasks(levelIdSafe, courseIdSafe, moduleIdSafe),
  });
  const puzzlesQuery = useQuery({
    queryKey: [
      "adminDebuts",
      "puzzles",
      levelIdSafe,
      courseIdSafe,
      moduleIdSafe,
      taskIdSafe,
    ],
    queryFn: () =>
      adminDebutsApi.listPuzzles(
        levelIdSafe,
        courseIdSafe,
        moduleIdSafe,
        taskIdSafe,
      ),
  });

  const studentsQuery = useQuery({
    queryKey: ["adminUsers", "students"],
    queryFn: adminUsersApi.listStudents,
    enabled: assignOpenForPuzzleId !== null,
  });
  const assignmentsQuery = useQuery({
    queryKey: [
      "adminDebuts",
      "puzzleAssignments",
      levelIdSafe,
      courseIdSafe,
      moduleIdSafe,
      taskIdSafe,
      assignOpenForPuzzleId,
    ],
    queryFn: () =>
      adminDebutsApi.listPuzzleAssignments(
        levelIdSafe,
        courseIdSafe,
        moduleIdSafe,
        taskIdSafe,
        assignOpenForPuzzleId as string,
      ),
    enabled: assignOpenForPuzzleId !== null,
  });

  const items: Puzzle[] = puzzlesQuery.data ?? [];
  const levelName =
    levelsQuery.data?.find((l) => l.id === levelIdSafe)?.name ?? "Debyut daraja";
  const courseName =
    coursesQuery.data?.find((c) => c.id === courseIdSafe)?.name ?? "Kurs";
  const moduleName =
    modulesQuery.data?.find((m) => m.id === moduleIdSafe)?.name ?? "Modul";
  const taskName =
    tasksQuery.data?.find((t) => t.id === taskIdSafe)?.name ?? "Vazifa";

  const students: Student[] = studentsQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];

  const assignmentsByStudentId = React.useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        studentId: string;
        studentLogin?: string;
        mode: PuzzleAssignmentMode;
        practiceLimit: number | null;
        practiceAttemptsUsed: number;
        assignedAt: string;
        completedAt: string | null;
      }
    >();
    for (const a of assignments) map.set(a.studentId, a);
    return map;
  }, [assignments]);

  const selectedAssignment = assignStudentId
    ? assignmentsByStudentId.get(assignStudentId) ?? null
    : null;

  const loading =
    levelsQuery.isLoading ||
    coursesQuery.isLoading ||
    modulesQuery.isLoading ||
    tasksQuery.isLoading ||
    puzzlesQuery.isLoading;

  React.useEffect(() => {
    const err =
      puzzlesQuery.error ??
      tasksQuery.error ??
      modulesQuery.error ??
      coursesQuery.error ??
      levelsQuery.error;
    if (err) {
      setError(err instanceof Error ? err.message : "Variantlarni yuklab bo'lmadi");
    }
  }, [
    puzzlesQuery.error,
    tasksQuery.error,
    modulesQuery.error,
    coursesQuery.error,
    levelsQuery.error,
  ]);

  React.useEffect(() => {
    if (!assignOpenForPuzzleId) return;
    const err = assignmentsQuery.error ?? studentsQuery.error;
    if (err) {
      setAssignError(
        err instanceof Error
          ? err.message
          : "O'quvchilar/tayinlovlarni yuklab bo'lmadi",
      );
    }
  }, [assignOpenForPuzzleId, assignmentsQuery.error, studentsQuery.error]);

  React.useEffect(() => {
    if (!assignOpenForPuzzleId) return;
    if (!assignStudentId && students.length > 0) {
      const firstId = students[0]!.id;
      setAssignStudentId(firstId);
      const existing = assignmentsByStudentId.get(firstId);
      setAssignMode(existing?.mode ?? "new");
      setAssignPracticeLimit(existing?.practiceLimit ? String(existing.practiceLimit) : "");
    }
  }, [assignOpenForPuzzleId, assignStudentId, students, assignmentsByStudentId]);

  const assignLoading = studentsQuery.isLoading || assignmentsQuery.isLoading;

  const isEditing = editingPuzzleId !== null;

  function resetForm() {
    setEditingPuzzleId(null);
    setNewName("");
    setNewPgn("");
    setNewMoves([]);
    setNewPgnNormalized("");
    setPgnError(null);
    setNewMoveDialogIdx(null);
    setNewMoveDialogValue("");
  }

  function startEdit(p: Puzzle) {
    setError(null);
    setEditingPuzzleId(p.id);
    setNewName(p.name);
    setNewPgn("");
    setNewMoves(Array.isArray(p.moves) ? p.moves : []);
    setNewPgnNormalized("");
    setPgnError(null);
    setNewMoveDialogIdx(null);
    setNewMoveDialogValue("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function mergeExplanations(prev: PuzzleMove[], next: PuzzleMove[]) {
    return next.map((m, idx) => {
      const prevAt = prev[idx];
      if (prevAt && prevAt.san === m.san)
        return { ...m, explanation: prevAt.explanation };
      return m;
    });
  }

  React.useEffect(() => {
    const raw = newPgn.trim();
    if (!raw) {
      setPgnError(null);
      if (!isEditing) {
        setNewMoves([]);
        setNewPgnNormalized("");
      }
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        const parsed = parsePgnToMoves(raw);
        setNewMoves((prev) => mergeExplanations(prev, parsed.moves));
        setNewPgnNormalized(parsed.normalizedPgn);
        setPgnError(null);
      } catch (e) {
        setPgnError(
          e instanceof Error
            ? e.message
            : "PGNni tahlil qilib bo'lmadi. To'g'ri PGN (SAN yurishlar) joylashtiring.",
        );
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [newPgn, isEditing]);

  const createPuzzleMutation = useMutation({
    mutationFn: (input: { name: string; moves: PuzzleMove[] }) =>
      adminDebutsApi.createPuzzle(
        levelIdSafe,
        courseIdSafe,
        moduleIdSafe,
        taskIdSafe,
        input,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [
          "adminDebuts",
          "puzzles",
          levelIdSafe,
          courseIdSafe,
          moduleIdSafe,
          taskIdSafe,
        ],
      });
    },
  });
  const updatePuzzleMutation = useMutation({
    mutationFn: (input: { puzzleId: string; name: string; moves: PuzzleMove[] }) =>
      adminDebutsApi.updatePuzzle(
        levelIdSafe,
        courseIdSafe,
        moduleIdSafe,
        taskIdSafe,
        input.puzzleId,
        {
          name: input.name,
          moves: input.moves,
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [
          "adminDebuts",
          "puzzles",
          levelIdSafe,
          courseIdSafe,
          moduleIdSafe,
          taskIdSafe,
        ],
      });
    },
  });
  const deletePuzzleMutation = useMutation({
    mutationFn: (puzzleId: string) =>
      adminDebutsApi.deletePuzzle(
        levelIdSafe,
        courseIdSafe,
        moduleIdSafe,
        taskIdSafe,
        puzzleId,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [
          "adminDebuts",
          "puzzles",
          levelIdSafe,
          courseIdSafe,
          moduleIdSafe,
          taskIdSafe,
        ],
      });
    },
  });

  const assignPuzzleMutation = useMutation({
    mutationFn: (input: {
      puzzleId: string;
      studentId: string;
      mode: PuzzleAssignmentMode;
      practiceLimit?: number;
    }) =>
      adminDebutsApi.assignPuzzleToStudent(
        levelIdSafe,
        courseIdSafe,
        moduleIdSafe,
        taskIdSafe,
        input.puzzleId,
        { studentId: input.studentId, mode: input.mode, practiceLimit: input.practiceLimit },
      ),
    onSuccess: async (_, vars) => {
      await queryClient.invalidateQueries({
        queryKey: [
          "adminDebuts",
          "puzzleAssignments",
          levelIdSafe,
          courseIdSafe,
          moduleIdSafe,
          taskIdSafe,
          vars.puzzleId,
        ],
      });
    },
  });

  const unassignPuzzleMutation = useMutation({
    mutationFn: (input: { puzzleId: string; assignmentId: string }) =>
      adminDebutsApi.deletePuzzleAssignment(
        levelIdSafe,
        courseIdSafe,
        moduleIdSafe,
        taskIdSafe,
        input.puzzleId,
        input.assignmentId,
      ),
    onSuccess: async (_, vars) => {
      await queryClient.invalidateQueries({
        queryKey: [
          "adminDebuts",
          "puzzleAssignments",
          levelIdSafe,
          courseIdSafe,
          moduleIdSafe,
          taskIdSafe,
          vars.puzzleId,
        ],
      });
    },
  });

  const busy =
    createPuzzleMutation.isPending ||
    updatePuzzleMutation.isPending ||
    deletePuzzleMutation.isPending ||
    assignPuzzleMutation.isPending ||
    unassignPuzzleMutation.isPending;

  const assignBusy =
    assignPuzzleMutation.isPending || unassignPuzzleMutation.isPending;

  async function unassign(assignmentId: string) {
    const puzzleId = assignOpenForPuzzleId;
    if (!puzzleId) return;
    try {
      setAssignError(null);
      await unassignPuzzleMutation.mutateAsync({ puzzleId, assignmentId });
      if (selectedAssignment?.id === assignmentId) {
        setAssignMode("new");
        setAssignPracticeLimit("");
      }
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : "Tayinlovni bekor qilib bo'lmadi");
    }
  }

  async function savePuzzle() {
    const name = newName.trim();
    if (!name) return;
    if (newMoves.length === 0) {
      setError("PGN kiriting (hali yurishlar yo'q).");
      return;
    }
    setError(null);
    try {
      if (editingPuzzleId) {
        await updatePuzzleMutation.mutateAsync({
          puzzleId: editingPuzzleId,
          name,
          moves: newMoves,
        });
      } else {
        await createPuzzleMutation.mutateAsync({ name, moves: newMoves });
      }
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Variantni saqlab bo'lmadi");
    }
  }

  async function remove(id: string) {
    if (!confirm("Variantni o'chirasizmi?")) return;
    setError(null);
    try {
      await deletePuzzleMutation.mutateAsync(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Variantni o'chirib bo'lmadi");
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
          {
            label: courseName,
            to: `/debuts/levels/${levelIdSafe}/courses/${courseIdSafe}/modules`,
          },
          {
            label: moduleName,
            to: `/debuts/levels/${levelIdSafe}/courses/${courseIdSafe}/modules/${moduleIdSafe}/tasks`,
          },
          { label: "Variantlar" },
        ]}
      />

      <DebutsPageHeader
        title="Variantlar"
        contextLabel="Vazifa"
        contextValue={taskName}
        loading={loading}
        backTo={`/debuts/levels/${levelIdSafe}/courses/${courseIdSafe}/modules/${moduleIdSafe}/tasks`}
      />

      {error ? <div className={debutsUi.error}>{error}</div> : null}
      {assignSuccess ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {assignSuccess}
        </div>
      ) : null}

      <div className={debutsUi.card}>
        <div className={debutsUi.formCardPad}>
          <input
            className={debutsUi.input}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Variant nomi"
          />
          <textarea
            className={debutsUi.textarea}
            rows={5}
            value={newPgn}
            onChange={(e) => setNewPgn(e.target.value)}
            placeholder="PGNni bu yerga joylashtiring (SAN yurishlar)"
          />
          {pgnError ? (
            <div className="text-xs text-red-600">{pgnError}</div>
          ) : newPgn.trim().length > 0 ? (
            <div className="text-xs text-slate-500">PGN avtomatik tahlil qilinadi.</div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={savePuzzle}>
              {isEditing ? "O'zgarishlarni saqlash" : "Variant qo'shish"}
            </Button>
            {isEditing ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={resetForm}
                title="Tahrirlashni bekor qilish"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          {newMoves.length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <div className="text-xs font-medium text-slate-700">
                Yurishlar + tushuntirishlar
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <div className="text-xs text-slate-500">
                  {newMoves.filter((m) => m.explanation.trim().length > 0).length}/{newMoves.length} tushuntirilgan
                </div>
              </div>
              <div className="mt-2 space-y-1.5">
                {newMoves.map((m, idx) => (
                  <div
                    key={`${idx}-${m.san}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-slate-600">
                        {formatMoveNumber(idx)} {m.san}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {m.explanation.trim().length > 0 ? "tushuntirilgan" : "tushuntirish yo'q"}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setNewMoveDialogIdx(idx);
                        setNewMoveDialogValue(m.explanation);
                      }}
                    >
                      {m.explanation.trim().length > 0 ? "Tahrirlash" : "Qo'shish"} tushuntirish
                    </Button>
                  </div>
                ))}
              </div>
              {newPgnNormalized ? (
                <div className="mt-2 text-xs text-slate-500">Normallashtirilgan PGN tayyor.</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {newMoveDialogIdx !== null ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setNewMoveDialogIdx(null)}
          />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Yurish tushuntirishi</div>
                <div className="mt-1 font-mono text-xs text-slate-600">
                  {formatMoveNumber(newMoveDialogIdx)} {newMoves[newMoveDialogIdx]?.san}
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setNewMoveDialogIdx(null)}
                title="Yopish"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-white">
              <ReactQuill
                theme="snow"
                value={newMoveDialogValue}
                onChange={setNewMoveDialogValue}
                modules={quillModules}
                formats={quillFormats}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                type="button"
                disabled={busy}
                title="Saqlash"
                onClick={() => {
                  const idx = newMoveDialogIdx;
                  if (idx === null) return;
                  const value = newMoveDialogValue;
                  setNewMoves((prev) => prev.map((x, i) => (i === idx ? { ...x, explanation: value } : x)));
                  setNewMoveDialogIdx(null);
                }}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setNewMoveDialogIdx(null)}
                title="Bekor qilish"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={debutsUi.card}>
        {loading ? (
          <div className={debutsUi.loadingBox}>
            <InlineSpinner />
            Variantlar yuklanmoqda…
          </div>
        ) : items.length === 0 ? (
          <div className={debutsUi.empty}>Hali pazllar yo'q.</div>
        ) : (
          <div className={debutsUi.listRows}>
            {items.map((p) => (
              <div key={p.id} className={[debutsUi.row, debutsUi.rowHover].join(" ")}>
                <div className="min-w-0 flex-1">
                  <TruncatedText text={p.name} className="text-sm font-medium text-slate-900" />
                  <div className="text-xs text-slate-500">{Array.isArray(p.moves) ? p.moves.length : 0} yurish</div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                  <button
                    type="button"
                    className={debutsUi.accentLink}
                    title="Ochish"
                    onClick={() =>
                      navigate(
                        `/debuts/levels/${levelIdSafe}/courses/${courseIdSafe}/modules/${moduleIdSafe}/tasks/${taskIdSafe}/puzzles/${p.id}/practice`,
                      )
                    }
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={debutsUi.indigoLink}
                    title="Tayinlash"
                    onClick={() => {
                      setAssignSuccess(null);
                      setAssignError(null);
                      setAssignMode("new");
                      setAssignPracticeLimit("");
                      setAssignStudentId("");
                      setAssignOpenForPuzzleId(p.id);
                    }}
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                  <button type="button" className={debutsUi.linkBtn} title="Tahrirlash" onClick={() => startEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" className={debutsUi.dangerBtn} title="O'chirish" onClick={() => void remove(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {assignOpenForPuzzleId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3"
          onMouseDown={() => {
            if (assignBusy) return;
            setAssignOpenForPuzzleId(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold">Variantni tayinlash</div>
            <div className="mt-1 text-sm text-slate-600">
              O'quvchi va tayinlash rejimini tanlang.
            </div>

            {assignError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                {assignError}
              </div>
            ) : null}

            {assignLoading ? (
              <div className="mt-3">
                <LoadingCard title="O'quvchilar yuklanmoqda…" lines={2} compact />
              </div>
            ) : (
              <>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-slate-700">
                      O'quvchi
                    </span>
                    <select
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400"
                      value={assignStudentId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setAssignStudentId(id);
                        const existing = id ? assignmentsByStudentId.get(id) : null;
                        setAssignMode(existing?.mode ?? "new");
                        setAssignPracticeLimit(existing?.practiceLimit ? String(existing.practiceLimit) : "");
                      }}
                      disabled={assignBusy}
                    >
                      {students.length === 0 ? <option value="">O'quvchilar yo'q</option> : null}
                      {students.map((s) => {
                        const a = assignmentsByStudentId.get(s.id);
                        const hasPracticeCounter =
                          typeof a?.practiceLimit === "number" &&
                          typeof a?.practiceAttemptsUsed === "number";
                        const practiceLeft = hasPracticeCounter
                          ? Math.max(0, (a?.practiceLimit ?? 0) - (a?.practiceAttemptsUsed ?? 0))
                          : null;
                        const status = a
                          ? a.completedAt
                            ? `bajarildi (${assignmentModeLabel(a.mode)})`
                            : a.mode === "test" && hasPracticeCounter
                              ? `tayinlandi (${assignmentModeLabel(a.mode)} qoldi: ${practiceLeft})`
                              : `tayinlandi (${assignmentModeLabel(a.mode)})`
                          : "tayinlanmagan";
                        return (
                          <option key={s.id} value={s.id}>
                            {s.login} — {status}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-slate-700">
                      Rejim
                    </span>
                    <select
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400"
                      value={assignMode}
                      onChange={(e) => {
                        const nextMode = e.target.value as PuzzleAssignmentMode;
                        setAssignMode(nextMode);
                        if (nextMode !== "test") setAssignPracticeLimit("");
                      }}
                      disabled={assignBusy || !assignStudentId}
                    >
                      <option value="new">o'rganish</option>
                      <option value="test">mashq</option>
                    </select>
                  </label>
                </div>

                {assignMode === "test" ? (
                  <label className="mt-3 grid gap-1">
                    <span className="text-xs font-medium text-slate-700">
                      Mashq urinishlar limiti (ixtiyoriy)
                    </span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400"
                      value={assignPracticeLimit}
                      onChange={(e) => setAssignPracticeLimit(e.target.value)}
                      disabled={assignBusy || !assignStudentId}
                      placeholder="Cheklanmagan"
                    />
                    <span className="text-xs text-slate-500">
                      Bo'sh qoldirilsa, mashq urinishlari cheklanmaydi.
                    </span>
                  </label>
                ) : null}

                {students.length > 0 ? (
                  <div className="mt-3 max-h-52 overflow-auto rounded-lg border border-slate-200">
                    <div className="sticky top-0 bg-white px-3 py-2 text-xs font-medium text-slate-700">
                      O'quvchilar
                    </div>
                    <div className="divide-y divide-slate-200">
                      {students.map((s) => {
                        const a = assignmentsByStudentId.get(s.id);
                        const isSelected = assignStudentId === s.id;
                        return (
                          <div
                            key={s.id}
                            role="button"
                            tabIndex={assignBusy ? -1 : 0}
                            className={[
                              "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm",
                              isSelected ? "bg-slate-50" : "bg-white hover:bg-slate-50",
                            ].join(" ")}
                            onClick={() => {
                              if (assignBusy) return;
                              setAssignStudentId(s.id);
                              setAssignMode(a?.mode ?? "new");
                              setAssignPracticeLimit(a?.practiceLimit ? String(a.practiceLimit) : "");
                            }}
                            onKeyDown={(e) => {
                              if (assignBusy) return;
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setAssignStudentId(s.id);
                                setAssignMode(a?.mode ?? "new");
                                setAssignPracticeLimit(a?.practiceLimit ? String(a.practiceLimit) : "");
                              }
                            }}
                            aria-disabled={assignBusy ? "true" : "false"}
                          >
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <TruncatedText text={s.login} className="text-sm font-medium text-slate-900" />
                                </div>
                                {a ? (
                                  <button
                                    type="button"
                                    className="shrink-0 text-xs font-medium text-red-600 hover:text-red-800"
                                    disabled={assignBusy}
                                    title="Tayinlovni bekor qilish"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const ok = confirm(`Tayinlovni bekor qilish: "${s.login}"?`);
                                      if (!ok) return;
                                      void unassign(a.id);
                                    }}
                                  >
                                    <UserMinus className="h-4 w-4" />
                                  </button>
                                ) : null}
                              </div>
                              <div className="text-xs text-slate-500">
                                {s.createdAt ? `Yaratilgan: ${new Date(s.createdAt).toLocaleDateString()}` : null}
                              </div>
                            </div>
                            <div className="shrink-0 text-xs">
                              {a ? (
                                <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">
                                  {a.completedAt ? "bajarildi" : "tayinlandi"} · {assignmentModeLabel(a.mode)}
                                  {a.mode === "test" &&
                                  typeof a.practiceLimit === "number" &&
                                  typeof a.practiceAttemptsUsed === "number"
                                    ? ` · qoldi: ${Math.max(0, a.practiceLimit - a.practiceAttemptsUsed)}`
                                    : ""}
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                                  tayinlanmagan
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={assignBusy || !assignStudentId}
                onClick={async () => {
                  const puzzleId = assignOpenForPuzzleId;
                  if (!puzzleId) return;
                  try {
                    setAssignSuccess(null);
                    setAssignError(null);
                    let practiceLimit: number | undefined;
                    if (assignMode === "test") {
                      const raw = assignPracticeLimit.trim();
                      if (raw.length > 0) {
                        const parsed = Number(raw);
                        if (!Number.isInteger(parsed) || parsed < 1) {
                          setAssignError("Mashq limiti 1 yoki undan katta butun son bo'lishi kerak.");
                          return;
                        }
                        practiceLimit = parsed;
                      }
                    }
                    await assignPuzzleMutation.mutateAsync({
                      puzzleId,
                      studentId: assignStudentId,
                      mode: assignMode,
                      practiceLimit,
                    });
                    setAssignSuccess("Variant muvaffaqiyatli tayinlandi.");
                    setAssignOpenForPuzzleId(null);
                  } catch (e) {
                    setAssignError(e instanceof Error ? e.message : "Variantni tayinlab bo'lmadi");
                  }
                }}
              >
                {assignBusy ? <InlineSpinner /> : selectedAssignment ? "Tayinlovni yangilash" : "Tayinlash"}
              </Button>
              {selectedAssignment ? (
                <Button
                  type="button"
                  variant="danger"
                  disabled={assignBusy}
                  onClick={async () => {
                    const ok = confirm(`Tanlangan o'quvchidan bu pazlni olib tashlamoqchimisiz?`);
                    if (!ok) return;
                    await unassign(selectedAssignment.id);
                  }}
                >
                  {assignBusy ? <InlineSpinner /> : "Tayinlovni bekor qilish"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                disabled={assignBusy}
                onClick={() => setAssignOpenForPuzzleId(null)}
                title="Yopish"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

