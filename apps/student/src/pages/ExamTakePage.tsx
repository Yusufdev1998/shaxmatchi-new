import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Chess } from "chess.js";
import confetti from "canvas-confetti";
import { BaseChessboard, Button } from "@shaxmatchi/ui";
import type { PieceDropHandlerArgs } from "react-chessboard";
import { ArrowRight, CheckCircle, Timer, XCircle } from "lucide-react";
import {
  studentExamsApi,
  type ExamAttemptFailDetail,
  type StudentExamAttemptPuzzle,
  type StudentExamAttemptStart,
} from "../api/studentExamsApi";
import { getAuthUser } from "../auth/auth";
import { isPwaUpdating } from "../pwaUpdate";
import {
  playAchievementSound,
  playCountdownBeep,
  playFailSound,
  playMoveSound,
} from "../lib/playSounds";

/** Optional review window (seconds) after a wrong move; the student can skip with "Keyingi". */
const REVIEW_SECONDS = 60;

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
    mutationFn: (args: { result: "passed" | "failed"; failDetail?: ExamAttemptFailDetail }) =>
      studentExamsApi.finalizeAttempt(attemptId!, args.result, args.failDetail),
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
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  // Optional post-mistake review state.
  const [reviewActive, setReviewActive] = React.useState(false);
  const [reviewSecondsLeft, setReviewSecondsLeft] = React.useState(0);
  const [reviewInfo, setReviewInfo] = React.useState<{
    reason: "wrong" | "timeout";
    playedSan: string | null;
    expectedSan: string | null;
  } | null>(null);
  const opponentTimerRef = React.useRef<number | null>(null);
  const boardWrapRef = React.useRef<HTMLDivElement | null>(null);
  const statusRef = React.useRef<Status>("in_progress");
  statusRef.current = status;
  // True while flashing a wrong move before advancing — blocks input/timer/opponent.
  const transitioningRef = React.useRef(false);
  // A single wrong move no longer ends the exam; we remember whether any puzzle was
  // missed and only fail the attempt at the end. `firstFailRef` keeps the first slip.
  const hadMistakeRef = React.useRef(false);
  const firstFailRef = React.useRef<ExamAttemptFailDetail | null>(null);

  const puzzle = attempt?.puzzles[puzzleIdx];
  const totalPuzzles = attempt?.puzzles.length ?? 0;

  // Keep mutation reference stable-ish by wrapping in a ref; avoids
  // re-triggering the timer/opponent effects on every render.
  const finalizeRef = React.useRef(finalizeMutation);
  finalizeRef.current = finalizeMutation;

  const triggerWrongFeedback = React.useCallback(() => {
    playFailSound();
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([35, 45, 35]);
      }
    } catch {
      /* ignore */
    }
    const el = boardWrapRef.current;
    if (!el) return;
    el.classList.remove("animate-board-shake");
    void el.offsetWidth;
    el.classList.add("animate-board-shake");
  }, []);

  const finishRef = React.useRef<() => void>(() => {});
  const advanceRef = React.useRef<() => void>(() => {});
  const failPuzzleRef = React.useRef<
    (reason: "wrong" | "timeout", playedSan?: string, trialFen?: string) => void
  >(() => {});

  finishRef.current = () => {
    if (statusRef.current !== "in_progress") return;
    const passed = !hadMistakeRef.current;
    const nextStatus: Status = passed ? "passed" : "failed";
    setStatus(nextStatus);
    statusRef.current = nextStatus;
    if (opponentTimerRef.current) {
      window.clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    if (passed) playAchievementSound();
    finalizeRef.current.mutate({
      result: nextStatus,
      failDetail: passed ? undefined : firstFailRef.current ?? undefined,
    });
  };

  advanceRef.current = () => {
    if (statusRef.current !== "in_progress") return;
    if (puzzleIdx + 1 < totalPuzzles) {
      setPuzzleIdx((i) => i + 1);
    } else {
      finishRef.current();
    }
  };

  // Wrong move / timeout on a puzzle: flash feedback (same feel as practice), record the
  // miss, then advance to the next puzzle instead of ending the exam.
  failPuzzleRef.current = (reason, playedSan, trialFen) => {
    if (statusRef.current !== "in_progress") return;
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    setIsTransitioning(true);
    hadMistakeRef.current = true;
    if (!firstFailRef.current && puzzle) {
      firstFailRef.current = {
        puzzleId: puzzle.id,
        puzzleName: puzzle.name,
        puzzleIndex: puzzleIdx,
        moveIndex: moveIdx,
        moveNumber: Math.floor(moveIdx / 2) + 1,
        reason,
        playedSan: playedSan ?? null,
        expectedSan: puzzle.moves[moveIdx]?.san ?? null,
      };
    }
    if (opponentTimerRef.current) {
      window.clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    triggerWrongFeedback();
    if (trialFen) {
      // Keep the attempted wrong move on the board so the student can review it.
      try {
        setGame(new Chess(trialFen));
      } catch {
        /* ignore */
      }
    }
    // Enter the optional review window; the student can wait or tap "Keyingi".
    setReviewInfo({
      reason,
      playedSan: playedSan ?? null,
      expectedSan: puzzle?.moves[moveIdx]?.san ?? null,
    });
    setReviewActive(true);
  };

  // Leave the review window (auto after REVIEW_SECONDS or via the "Keyingi" button).
  const continueAfterReview = React.useCallback(() => {
    if (!transitioningRef.current) return;
    transitioningRef.current = false;
    setIsTransitioning(false);
    setReviewActive(false);
    setReviewInfo(null);
    advanceRef.current();
  }, []);

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
    if (isTransitioning) return;
    if (moveIdx >= puzzle.moves.length) {
      if (puzzleIdx + 1 < totalPuzzles) {
        setPuzzleIdx((i) => i + 1);
      } else {
        finishRef.current();
      }
      return;
    }
    if (isStudentMoveAtIndex(puzzle, moveIdx)) return;

    const expected = puzzle.moves[moveIdx]!.san;
    opponentTimerRef.current = window.setTimeout(() => {
      opponentTimerRef.current = null;
      let moved = false;
      setGame((prev) => {
        const next = new Chess(prev.fen());
        try {
          next.move(expected);
        } catch {
          return prev;
        }
        moved = true;
        return next;
      });
      if (moved) playMoveSound();
      setMoveIdx((i) => i + 1);
    }, OPPONENT_MOVE_DELAY_MS);
    return () => {
      if (opponentTimerRef.current) {
        window.clearTimeout(opponentTimerRef.current);
        opponentTimerRef.current = null;
      }
    };
  }, [attempt, puzzle, puzzleIdx, moveIdx, totalPuzzles, status, isTransitioning]);

  // Per-move countdown (only while it's the student's turn).
  React.useEffect(() => {
    if (!attempt || !puzzle) return;
    if (status !== "in_progress") return;
    if (isTransitioning) return;
    if (moveIdx >= puzzle.moves.length) return;
    if (!isStudentMoveAtIndex(puzzle, moveIdx)) return;

    const duration = attempt.secondsPerMove;
    setSecondsLeft(duration);
    const startedAt = Date.now();
    let lastLeft = duration;
    const tick = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const left = Math.max(0, duration - elapsed);
      if (left !== lastLeft) {
        lastLeft = left;
        // A single warning beep at 10s, then a beep every second for the last 5.
        if (left === 10) {
          playCountdownBeep(false);
        } else if (left >= 1 && left <= 5) {
          playCountdownBeep(true);
        }
      }
      setSecondsLeft(left);
      if (left <= 0) {
        window.clearInterval(tick);
        failPuzzleRef.current("timeout");
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [attempt, puzzle, moveIdx, status, isTransitioning]);

  // Warn on navigation while in progress — except when the user opted into a PWA update,
  // whose reload would otherwise be cancelled by this guard.
  React.useEffect(() => {
    if (status !== "in_progress") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isPwaUpdating()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);

  // Optional review countdown after a wrong move; auto-continues when it hits zero.
  React.useEffect(() => {
    if (!reviewActive) return;
    setReviewSecondsLeft(REVIEW_SECONDS);
    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      const left = Math.max(0, REVIEW_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
      setReviewSecondsLeft(left);
      if (left <= 0) {
        window.clearInterval(tick);
        continueAfterReview();
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [reviewActive, continueAfterReview]);

  // After pass/fail, auto-navigate back to the exams list (longer on pass to enjoy the moment).
  React.useEffect(() => {
    if (status === "in_progress") return;
    const t = window.setTimeout(() => {
      navigate("/exams");
    }, status === "passed" ? 7000 : 3500);
    return () => window.clearTimeout(t);
  }, [status, navigate]);

  // Celebrate a clean pass with a confetti burst.
  React.useEffect(() => {
    if (status !== "passed") return;
    confetti({ particleCount: 140, spread: 75, origin: { y: 0.6 } });
    const end = Date.now() + 1600;
    let raf = 0;
    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0 } });
      confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1 } });
      if (Date.now() < end) raf = window.requestAnimationFrame(frame);
    };
    frame();
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      confetti.reset();
    };
  }, [status]);

  const onPieceDrop = React.useCallback(
    (args: PieceDropHandlerArgs): boolean => {
      if (!puzzle) return false;
      if (statusRef.current !== "in_progress") return false;
      if (transitioningRef.current) return false;
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
        // Show the wrong move briefly, then move on to the next puzzle.
        failPuzzleRef.current("wrong", trialMove.san, trial.fen());
        return true;
      }
      playMoveSound();
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
  // While reviewing a mistake the per-move timer is paused; show the review countdown instead.
  const timerSeconds = reviewActive ? reviewSecondsLeft : secondsLeft;
  const timerTone = reviewActive
    ? "text-rose-600"
    : secondsLeft <= 3
      ? "text-red-600"
      : secondsLeft <= 10
        ? "text-amber-600"
        : "text-slate-700";
  const studentName = getAuthUser()?.login?.trim() || "";
  const isLastPuzzle = puzzleIdx + 1 >= totalPuzzles;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Pazl {puzzleIdx + 1} / {totalPuzzles}
          </div>
          <div className="truncate text-sm font-semibold text-slate-900">{puzzle.name}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end leading-tight">
          {reviewActive ? (
            <span className="text-[10px] font-medium uppercase tracking-wide text-rose-500">
              Ko'rib chiqish
            </span>
          ) : null}
          <div className="flex items-center gap-1.5">
            <Timer className={`h-4 w-4 ${timerTone} ${reviewActive ? "animate-pulse" : ""}`} />
            <span className={`font-mono text-sm font-semibold ${timerTone}`}>{timerSeconds}s</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div
          ref={boardWrapRef}
          onAnimationEnd={(e) => {
            if (!e.animationName.includes("board-shake")) return;
            e.currentTarget.classList.remove("animate-board-shake");
          }}
          className={`origin-center will-change-transform ${
            !studentsTurn || status !== "in_progress" || isTransitioning
              ? "pointer-events-none opacity-90"
              : ""
          }`}
        >
          <BaseChessboard
            options={{
              position: game.fen(),
              boardOrientation,
              onPieceDrop,
            }}
          />
        </div>
        <div className="mt-2 text-center text-xs text-slate-500">
          {status !== "in_progress" || reviewActive
            ? null
            : studentsTurn
              ? "Yurishingizni qiling"
              : "Raqib yurmoqda…"}
        </div>
      </div>

      {status === "in_progress" && reviewActive ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 shadow-sm">
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-red-800">
                {reviewInfo?.reason === "timeout" ? "Vaqt tugadi" : "Xato yurish"}
              </div>
              <div className="mt-0.5 text-xs text-red-700">
                {reviewInfo?.reason === "wrong" && reviewInfo?.playedSan ? (
                  <>
                    Siz yurdingiz: <span className="font-mono font-semibold">{reviewInfo.playedSan}</span>
                    {reviewInfo?.expectedSan ? " · " : null}
                  </>
                ) : null}
                {reviewInfo?.expectedSan ? (
                  <>
                    To'g'ri yurish: <span className="font-mono font-semibold">{reviewInfo.expectedSan}</span>
                  </>
                ) : (
                  "Bu pazl xato hisoblandi."
                )}
              </div>
              <div className="mt-1 text-[11px] text-red-500">
                Xatoni ko'rib chiqing — {reviewSecondsLeft}s dan so'ng avtomatik davom etadi.
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={continueAfterReview}>
              {isLastPuzzle ? "Yakunlash" : "Keyingi pazl"}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

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
                <CheckCircle className="h-12 w-12 text-emerald-600" />
              ) : (
                <XCircle className="h-10 w-10 text-red-600" />
              )}
              {status === "passed" ? <div className="text-3xl" aria-hidden>🎉</div> : null}
              <div className="text-lg font-bold">
                {status === "passed"
                  ? studentName
                    ? `Tabriklaymiz, ${studentName}!`
                    : "Tabriklaymiz!"
                  : "Imtihondan o'ta olmadingiz"}
              </div>
              <div className="text-sm">
                {status === "passed"
                  ? "Ajoyib natija — barcha pazllarni xatosiz yechdingiz! 👏"
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
