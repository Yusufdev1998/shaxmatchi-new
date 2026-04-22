import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Chess } from "chess.js";
import { BaseChessboard, Button } from "@shaxmatchi/ui";
import type { PieceDropHandlerArgs } from "react-chessboard";
import { CheckCircle, Timer, XCircle } from "lucide-react";
import {
  studentExamsApi,
  type StudentExamAttemptPuzzle,
  type StudentExamAttemptStart,
} from "../api/studentExamsApi";

/** Ms delay before auto-playing an opponent move — matches the practice-mode feel. */
const OPPONENT_MOVE_DELAY_MS = 450;

type Status = "in_progress" | "passed" | "failed";

function expectedMoveAt(
  puzzle: StudentExamAttemptPuzzle | undefined,
  moveIdx: number,
): string | null {
  if (!puzzle) return null;
  const move = puzzle.moves[moveIdx];
  return move?.san ?? null;
}

function isStudentMoveAtIndex(
  puzzle: StudentExamAttemptPuzzle,
  moveIdx: number,
): boolean {
  // idx 0 corresponds to White's first move. Student plays moves on their side only.
  return puzzle.studentSide === "white" ? moveIdx % 2 === 0 : moveIdx % 2 === 1;
}

export function ExamTakePage() {
  const { examId, attemptId } = useParams<{ examId: string; attemptId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const attempt = queryClient.getQueryData<StudentExamAttemptStart>([
    "studentExamAttempt",
    attemptId,
  ]);

  const finalizeMutation = useMutation({
    mutationFn: (result: "passed" | "failed") =>
      studentExamsApi.finalizeAttempt(attemptId!, result),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["studentExam", examId] });
      await queryClient.invalidateQueries({ queryKey: ["studentExams"] });
    },
  });

  const [puzzleIdx, setPuzzleIdx] = React.useState(0);
  const [moveIdx, setMoveIdx] = React.useState(0);
  const [game, setGame] = React.useState(() => new Chess());
  const [status, setStatus] = React.useState<Status>("in_progress");
  const [secondsLeft, setSecondsLeft] = React.useState<number>(attempt?.secondsPerMove ?? 0);
  const opponentTimerRef = React.useRef<number | null>(null);
  const statusRef = React.useRef<Status>("in_progress");
  statusRef.current = status;

  const puzzle = attempt?.puzzles[puzzleIdx];
  const totalPuzzles = attempt?.puzzles.length ?? 0;

  // Keep mutation reference stable-ish by wrapping in a ref; avoids
  // re-triggering the timer/opponent effects on every render.
  const finalizeRef = React.useRef(finalizeMutation);
  finalizeRef.current = finalizeMutation;

  const failRef = React.useRef<(reason: "wrong" | "timeout") => void>(() => {});
  const passRef = React.useRef<() => void>(() => {});

  failRef.current = (_reason) => {
    if (statusRef.current !== "in_progress") return;
    setStatus("failed");
    statusRef.current = "failed";
    if (opponentTimerRef.current) {
      window.clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    finalizeRef.current.mutate("failed");
  };
  passRef.current = () => {
    if (statusRef.current !== "in_progress") return;
    setStatus("passed");
    statusRef.current = "passed";
    finalizeRef.current.mutate("passed");
  };

  // Reset board at the start of each puzzle.
  React.useEffect(() => {
    if (!attempt || !puzzle) return;
    const fresh = new Chess();
    setGame(fresh);
    setMoveIdx(0);
  }, [attempt, puzzleIdx, puzzle]);

  // Auto-play opponent move when it's their turn, or advance puzzle when done.
  React.useEffect(() => {
    if (!attempt || !puzzle) return;
    if (status !== "in_progress") return;
    if (moveIdx >= puzzle.moves.length) {
      if (puzzleIdx + 1 < totalPuzzles) {
        setPuzzleIdx((i) => i + 1);
      } else {
        passRef.current();
      }
      return;
    }
    if (isStudentMoveAtIndex(puzzle, moveIdx)) return;

    const expected = puzzle.moves[moveIdx]!.san;
    opponentTimerRef.current = window.setTimeout(() => {
      opponentTimerRef.current = null;
      setGame((prev) => {
        const next = new Chess(prev.fen());
        try {
          next.move(expected);
        } catch {
          return prev;
        }
        return next;
      });
      setMoveIdx((i) => i + 1);
    }, OPPONENT_MOVE_DELAY_MS);
    return () => {
      if (opponentTimerRef.current) {
        window.clearTimeout(opponentTimerRef.current);
        opponentTimerRef.current = null;
      }
    };
  }, [attempt, puzzle, puzzleIdx, moveIdx, totalPuzzles, status]);

  // Per-move countdown (only while it's the student's turn).
  React.useEffect(() => {
    if (!attempt || !puzzle) return;
    if (status !== "in_progress") return;
    if (moveIdx >= puzzle.moves.length) return;
    if (!isStudentMoveAtIndex(puzzle, moveIdx)) return;

    const duration = attempt.secondsPerMove;
    setSecondsLeft(duration);
    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const left = Math.max(0, duration - elapsed);
      setSecondsLeft(left);
      if (left <= 0) {
        window.clearInterval(tick);
        failRef.current("timeout");
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [attempt, puzzle, moveIdx, status]);

  // Warn on navigation while in progress.
  React.useEffect(() => {
    if (status !== "in_progress") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  // After pass/fail, auto-navigate back to the exams list.
  const RESULT_MODAL_DURATION_MS = 3500;
  React.useEffect(() => {
    if (status === "in_progress") return;
    const t = window.setTimeout(() => {
      navigate("/exams");
    }, RESULT_MODAL_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [status, navigate]);

  const onPieceDrop = React.useCallback(
    (args: PieceDropHandlerArgs): boolean => {
      if (!puzzle) return false;
      if (statusRef.current !== "in_progress") return false;
      if (moveIdx >= puzzle.moves.length) return false;
      if (!isStudentMoveAtIndex(puzzle, moveIdx)) return false;
      const from = args.sourceSquare as string;
      const to = args.targetSquare as string;
      if (!from || !to) return false;
      const expected = expectedMoveAt(puzzle, moveIdx);
      if (!expected) return false;

      const trial = new Chess(game.fen());
      let trialMove;
      try {
        trialMove = trial.move({ from, to, promotion: "q" });
      } catch {
        return false;
      }
      if (!trialMove) return false;
      if (trialMove.san !== expected) {
        failRef.current("wrong");
        return false;
      }
      setGame(trial);
      setMoveIdx((i) => i + 1);
      return true;
    },
    [puzzle, moveIdx, game],
  );

  if (!attemptId || !examId) return null;
  if (!attempt) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Urinish ma'lumoti topilmadi. Imtihonni qayta boshlang.
        </div>
        <Button asChild variant="secondary">
          <Link to={`/exams/${examId}`}>Imtihonga qaytish</Link>
        </Button>
      </div>
    );
  }
  if (!puzzle) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-500 shadow-sm">
        Yuklanmoqda…
      </div>
    );
  }

  const boardOrientation: "white" | "black" = puzzle.studentSide;
  const studentsTurn =
    status === "in_progress" && moveIdx < puzzle.moves.length && isStudentMoveAtIndex(puzzle, moveIdx);
  const timerTone = secondsLeft <= 3 ? "text-red-600" : secondsLeft <= 10 ? "text-amber-600" : "text-slate-700";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Pazl {puzzleIdx + 1} / {totalPuzzles}
          </div>
          <div className="truncate text-sm font-semibold text-slate-900">{puzzle.name}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Timer className={`h-4 w-4 ${timerTone}`} />
          <span className={`font-mono text-sm font-semibold ${timerTone}`}>{secondsLeft}s</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className={!studentsTurn || status !== "in_progress" ? "pointer-events-none opacity-90" : ""}>
          <BaseChessboard
            options={{
              position: game.fen(),
              boardOrientation,
              onPieceDrop,
            }}
          />
        </div>
        <div className="mt-2 text-center text-xs text-slate-500">
          {status === "in_progress" && studentsTurn
            ? "Yurishingizni qiling"
            : status === "in_progress"
              ? "Raqib yurmoqda…"
              : null}
        </div>
      </div>

      {status !== "in_progress" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className={`w-full max-w-sm rounded-xl border p-4 shadow-2xl ${
              status === "passed"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              {status === "passed" ? (
                <CheckCircle className="h-10 w-10 text-emerald-600" />
              ) : (
                <XCircle className="h-10 w-10 text-red-600" />
              )}
              <div className="text-base font-semibold">
                {status === "passed" ? "Tabriklaymiz!" : "Imtihondan o'ta olmadingiz"}
              </div>
              <div className="text-sm">
                {status === "passed"
                  ? "Barcha pazllarni xatosiz yechdingiz."
                  : "Keyingi urinishda muvaffaqiyat tilaymiz."}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Imtihonlar sahifasiga qaytilyapti…
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <Button size="sm" variant="secondary" onClick={() => navigate("/exams")}>
                Hoziroq qaytish
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
