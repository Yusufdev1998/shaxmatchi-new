import * as React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

/** Celebration window (seconds) after solving a puzzle, before moving to the next one. */
const SUCCESS_SECONDS = 3;

/** Ms delay before auto-playing an opponent move — matches the practice-mode feel. */
const OPPONENT_MOVE_DELAY_MS = 450;

/** How often we tell the server the attempt is still alive (server grace is 10 min). */
const HEARTBEAT_MS = 30_000;

/**
 * The per-move clock pauses while the app is backgrounded (screen lock, app switch,
 * incoming call) — otherwise a student who glances away loses the move, and with it the
 * whole exam. This caps how much time may be parked that way on a single move, so the
 * pause cannot be used as unlimited thinking time.
 */
const MAX_HIDDEN_MS_PER_MOVE = 120_000;

type Status = "in_progress" | "passed" | "failed";

type FinalizeArgs = { result: "passed" | "failed"; failDetails?: ExamAttemptFailDetail[] };

/**
 * Mid-attempt progress, mirrored to localStorage so a reload, a PWA update or an
 * eviction by the mobile OS resumes where the student left off instead of burning
 * the attempt.
 */
type SavedProgress = {
  puzzleIdx: number;
  moveIdx: number;
  hadMistake: boolean;
  fails: ExamAttemptFailDetail[];
};

const progressKey = (attemptId: string) => `examProgress:${attemptId}`;
const resultKey = (attemptId: string) => `examResult:${attemptId}`;

function loadProgress(attemptId: string | undefined): SavedProgress | null {
  if (!attemptId) return null;
  try {
    const raw = window.localStorage.getItem(progressKey(attemptId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    if (typeof parsed?.puzzleIdx !== "number" || typeof parsed?.moveIdx !== "number") return null;
    return {
      puzzleIdx: parsed.puzzleIdx,
      moveIdx: parsed.moveIdx,
      hadMistake: parsed.hadMistake === true,
      fails: Array.isArray(parsed.fails) ? parsed.fails : [],
    };
  } catch {
    return null;
  }
}

/** A result we decided locally but have not yet managed to send to the server. */
function loadPendingResult(attemptId: string | undefined): FinalizeArgs | null {
  if (!attemptId) return null;
  try {
    const raw = window.localStorage.getItem(resultKey(attemptId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FinalizeArgs>;
    if (parsed?.result !== "passed" && parsed?.result !== "failed") return null;
    return {
      result: parsed.result,
      failDetails: Array.isArray(parsed.failDetails) ? parsed.failDetails : undefined,
    };
  } catch {
    return null;
  }
}

function writeKey(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / quota) — play on without persistence */
  }
}

function removeKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

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

  // Read once, on mount: anything left behind by a previous (interrupted) session.
  const savedProgressRef = React.useRef<SavedProgress | null>(loadProgress(attemptId));
  const [pendingResult] = React.useState<FinalizeArgs | null>(() => loadPendingResult(attemptId));

  /**
   * The attempt is fetched through `useQuery`, not read out of the cache with
   * `getQueryData`. An observer is what keeps the entry alive (an unobserved entry is
   * garbage-collected after `gcTime`, which used to wipe the board mid-exam), and the
   * queryFn is what lets a reload resume the attempt from the server.
   */
  const attemptQuery = useQuery({
    queryKey: ["studentExamAttempt", attemptId],
    queryFn: () => studentExamsApi.getAttempt(attemptId!),
    // With a result already decided we no longer need the puzzles, and the server would
    // reject the fetch once the attempt is finalized.
    enabled: !!attemptId && !pendingResult,
    staleTime: Infinity,
    gcTime: 60 * 60_000,
    refetchOnMount: false,
    retry: 3,
  });
  const attempt: StudentExamAttemptStart | undefined = attemptQuery.data;

  const resultArgsRef = React.useRef<FinalizeArgs | null>(pendingResult);
  const finalizeMutation = useMutation({
    mutationFn: (args: FinalizeArgs) =>
      studentExamsApi.finalizeAttempt(attemptId!, args.result, args.failDetails),
    // A dropped request used to silently turn a pass into a fail: the attempt stayed
    // `in_progress` and was later swept as abandoned. Mutations do not retry by default.
    retry: 5,
    retryDelay: (retryIdx) => Math.min(1000 * 2 ** retryIdx, 15_000),
    onSuccess: async () => {
      if (attemptId) {
        removeKey(resultKey(attemptId));
        removeKey(progressKey(attemptId));
      }
      await queryClient.invalidateQueries({ queryKey: ["studentExam", examId] });
      await queryClient.invalidateQueries({ queryKey: ["studentExams"] });
    },
  });

  const [puzzleIdx, setPuzzleIdx] = React.useState(() => savedProgressRef.current?.puzzleIdx ?? 0);
  const [moveIdx, setMoveIdx] = React.useState(0);
  const [game, setGame] = React.useState(() => new Chess());
  const [status, setStatus] = React.useState<Status>(() => pendingResult?.result ?? "in_progress");
  const [secondsLeft, setSecondsLeft] = React.useState<number>(0);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  // Optional post-mistake review state.
  const [reviewActive, setReviewActive] = React.useState(false);
  const [reviewSecondsLeft, setReviewSecondsLeft] = React.useState(0);
  const [reviewInfo, setReviewInfo] = React.useState<{
    reason: "wrong" | "timeout";
    playedSan: string | null;
    expectedSan: string | null;
  } | null>(null);
  // Short celebration shown after a puzzle is solved cleanly, before advancing to the next one.
  const [successActive, setSuccessActive] = React.useState(false);
  const [successSecondsLeft, setSuccessSecondsLeft] = React.useState(0);
  const opponentTimerRef = React.useRef<number | null>(null);
  const boardWrapRef = React.useRef<HTMLDivElement | null>(null);
  const statusRef = React.useRef<Status>(status);
  statusRef.current = status;
  // True while flashing a wrong move before advancing — blocks input/timer/opponent.
  const transitioningRef = React.useRef(false);
  // A single wrong move no longer ends the exam; we remember whether any puzzle was
  // missed and only fail the attempt at the end. `failsRef` collects every mistake so the
  // teacher can review all of them (not just the first).
  const hadMistakeRef = React.useRef(savedProgressRef.current?.hadMistake ?? false);
  const failsRef = React.useRef<ExamAttemptFailDetail[]>(savedProgressRef.current?.fails ?? []);
  const restoredRef = React.useRef(false);
  // Set in the same batch as the restored puzzle/move, so the mirror effect below never
  // writes pre-restore values back over the saved progress.
  const [restored, setRestored] = React.useState(false);
  // Per-move clock, tracked in ms so it can be paused and resumed.
  const remainingMsRef = React.useRef(0);
  const hiddenMsRef = React.useRef(0);
  const hiddenSinceRef = React.useRef<number | null>(null);

  const puzzle = attempt?.puzzles[puzzleIdx];
  const totalPuzzles = attempt?.puzzles.length ?? 0;

  // Keep mutation reference stable-ish by wrapping in a ref; avoids
  // re-triggering the timer/opponent effects on every render.
  const finalizeRef = React.useRef(finalizeMutation);
  finalizeRef.current = finalizeMutation;

  // Is the app in the background? The per-move clock is frozen while it is.
  const [isHidden, setIsHidden] = React.useState(
    () => typeof document !== "undefined" && document.visibilityState === "hidden",
  );
  React.useEffect(() => {
    const onVisibilityChange = () => {
      const hidden = document.visibilityState === "hidden";
      if (hidden) {
        if (hiddenSinceRef.current === null) hiddenSinceRef.current = Date.now();
      } else if (hiddenSinceRef.current !== null) {
        hiddenMsRef.current += Date.now() - hiddenSinceRef.current;
        hiddenSinceRef.current = null;
      }
      setIsHidden(hidden);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

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
  const enterSuccessRef = React.useRef<() => void>(() => {});
  const failPuzzleRef = React.useRef<
    (reason: "wrong" | "timeout", playedSan?: string, trialFen?: string) => void
  >(() => {});

  finishRef.current = () => {
    if (statusRef.current !== "in_progress") return;
    const passed = !hadMistakeRef.current;
    const nextStatus: Status = passed ? "passed" : "failed";
    const args: FinalizeArgs = {
      result: nextStatus,
      failDetails: passed ? undefined : failsRef.current,
    };
    setStatus(nextStatus);
    statusRef.current = nextStatus;
    if (opponentTimerRef.current) {
      window.clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    // Persist the verdict before sending it: if the app dies mid-request we can still
    // deliver it on the next open instead of letting the attempt rot as abandoned.
    if (attemptId) writeKey(resultKey(attemptId), args);
    resultArgsRef.current = args;
    if (passed) playAchievementSound();
    finalizeRef.current.mutate(args);
  };

  advanceRef.current = () => {
    if (statusRef.current !== "in_progress") return;
    if (puzzleIdx + 1 < totalPuzzles) {
      // Reset the board together with the puzzle index so the completion check never sees a
      // move index left over from the puzzle we're leaving.
      setGame(new Chess());
      setMoveIdx(0);
      setPuzzleIdx((i) => i + 1);
    } else {
      finishRef.current();
    }
  };

  // A puzzle was solved cleanly. On the last puzzle, go straight to the final result (which
  // carries its own, bigger celebration). Otherwise play a short congrats, hold for a few
  // seconds so the student can enjoy it, then advance to the next puzzle.
  enterSuccessRef.current = () => {
    if (statusRef.current !== "in_progress") return;
    if (transitioningRef.current) return;
    if (puzzleIdx + 1 >= totalPuzzles) {
      finishRef.current();
      return;
    }
    transitioningRef.current = true;
    setIsTransitioning(true);
    if (opponentTimerRef.current) {
      window.clearTimeout(opponentTimerRef.current);
      opponentTimerRef.current = null;
    }
    playAchievementSound();
    setSuccessActive(true);
  };

  // Wrong move / timeout on a puzzle: flash feedback (same feel as practice), record the
  // miss, then advance to the next puzzle instead of ending the exam.
  failPuzzleRef.current = (reason, playedSan, trialFen) => {
    if (statusRef.current !== "in_progress") return;
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    setIsTransitioning(true);
    hadMistakeRef.current = true;
    if (puzzle) {
      failsRef.current.push({
        puzzleId: puzzle.id,
        puzzleName: puzzle.name,
        puzzleIndex: puzzleIdx,
        moveIndex: moveIdx,
        moveNumber: Math.floor(moveIdx / 2) + 1,
        reason,
        playedSan: playedSan ?? null,
        expectedSan: puzzle.moves[moveIdx]?.san ?? null,
      });
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

  // Leave the success window (auto after SUCCESS_SECONDS or via the "Keyingi pazl" button).
  const continueAfterSuccess = React.useCallback(() => {
    if (!transitioningRef.current) return;
    transitioningRef.current = false;
    setIsTransitioning(false);
    setSuccessActive(false);
    advanceRef.current();
  }, []);

  // Restore an interrupted attempt once the puzzles arrive: replay the moves already
  // played on the saved puzzle so the board matches where the student stopped.
  // (`advanceRef` resets the board with the puzzle index, so no reset effect is needed.)
  React.useEffect(() => {
    if (restoredRef.current) return;
    if (!attempt) return;
    restoredRef.current = true;
    const saved = savedProgressRef.current;
    if (!saved) {
      setRestored(true);
      return;
    }
    const idx = Math.min(Math.max(0, saved.puzzleIdx), attempt.puzzles.length - 1);
    const target = attempt.puzzles[idx];
    if (!target) {
      setRestored(true);
      return;
    }
    const upTo = Math.min(Math.max(0, saved.moveIdx), target.moves.length);
    const board = new Chess();
    let applied = 0;
    for (let i = 0; i < upTo; i++) {
      try {
        board.move(target.moves[i]!.san);
        applied += 1;
      } catch {
        break;
      }
    }
    setPuzzleIdx(idx);
    setMoveIdx(applied);
    setGame(board);
    setRestored(true);
  }, [attempt]);

  // Mirror progress so an interruption resumes instead of burning the attempt.
  React.useEffect(() => {
    if (!attemptId) return;
    if (!attempt) return;
    if (!restored) return;
    if (status !== "in_progress") return;
    writeKey(progressKey(attemptId), {
      puzzleIdx,
      moveIdx,
      hadMistake: hadMistakeRef.current,
      fails: failsRef.current,
    } satisfies SavedProgress);
  }, [attemptId, attempt, restored, status, puzzleIdx, moveIdx, isTransitioning]);

  // Tell the server we are still here, so the abandonment sweeper leaves us alone.
  React.useEffect(() => {
    if (!attemptId) return;
    if (status !== "in_progress") return;
    const send = () => {
      void studentExamsApi.heartbeat(attemptId).catch(() => {
        /* offline is fine — the next beat will do */
      });
    };
    send();
    const id = window.setInterval(send, HEARTBEAT_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") send();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [attemptId, status]);

  // A result decided in an earlier session that never reached the server: send it now.
  React.useEffect(() => {
    if (!pendingResult || !attemptId) return;
    finalizeRef.current.mutate(pendingResult);
    // Mount-only: `pendingResult` is read once from storage and never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-play opponent move when it's their turn, or advance puzzle when done.
  React.useEffect(() => {
    if (!attempt || !puzzle) return;
    if (status !== "in_progress") return;
    if (isTransitioning) return;
    if (moveIdx >= puzzle.moves.length) {
      // Puzzle solved — celebrate, then advance (or finish on the last puzzle).
      enterSuccessRef.current();
      return;
    }
    if (isStudentMoveAtIndex(puzzle, moveIdx)) return;

    const expected = puzzle.moves[moveIdx]!.san;
    // Black-side puzzles open with White's move; play it instantly so the student
    // lands on their own first decision instead of watching the start position.
    const delayMs = moveIdx === 0 ? 0 : OPPONENT_MOVE_DELAY_MS;
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
    }, delayMs);
    return () => {
      if (opponentTimerRef.current) {
        window.clearTimeout(opponentTimerRef.current);
        opponentTimerRef.current = null;
      }
    };
  }, [attempt, puzzle, puzzleIdx, moveIdx, totalPuzzles, status, isTransitioning]);

  // Hand the student a fresh clock whenever it becomes their move. Declared before the
  // ticking effect so the budget is reset before the interval reads it.
  React.useEffect(() => {
    if (!attempt || !puzzle) return;
    if (status !== "in_progress") return;
    if (isTransitioning) return;
    if (moveIdx >= puzzle.moves.length) return;
    if (!isStudentMoveAtIndex(puzzle, moveIdx)) return;
    remainingMsRef.current = attempt.secondsPerMove * 1000;
    hiddenMsRef.current = 0;
    hiddenSinceRef.current = document.visibilityState === "hidden" ? Date.now() : null;
    setSecondsLeft(attempt.secondsPerMove);
  }, [attempt, puzzle, puzzleIdx, moveIdx, status, isTransitioning]);

  // Per-move countdown (only while it's the student's turn, and only while visible).
  React.useEffect(() => {
    if (!attempt || !puzzle) return;
    if (status !== "in_progress") return;
    if (isTransitioning) return;
    if (moveIdx >= puzzle.moves.length) return;
    if (!isStudentMoveAtIndex(puzzle, moveIdx)) return;

    // Frozen while backgrounded: the student cannot see the board, so they should not
    // lose the move for it. The interval simply does not run.
    if (isHidden) return;
    if (hiddenMsRef.current > MAX_HIDDEN_MS_PER_MOVE) {
      failPuzzleRef.current("timeout");
      return;
    }

    let last = Date.now();
    let lastLeft = Math.max(0, Math.ceil(remainingMsRef.current / 1000));
    const tick = window.setInterval(() => {
      const now = Date.now();
      remainingMsRef.current -= now - last;
      last = now;
      const left = Math.max(0, Math.ceil(remainingMsRef.current / 1000));
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
      if (remainingMsRef.current <= 0) {
        window.clearInterval(tick);
        failPuzzleRef.current("timeout");
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [attempt, puzzle, moveIdx, status, isTransitioning, isHidden]);

  // Warn on navigation while the attempt is live or its result is still unsent — except
  // when the user opted into a PWA update, whose reload this guard would cancel.
  const resultSaved = finalizeMutation.isSuccess;
  React.useEffect(() => {
    if (status !== "in_progress" && resultSaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isPwaUpdating()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status, resultSaved]);

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

  // Celebration countdown after a solved puzzle; auto-advances when it hits zero.
  React.useEffect(() => {
    if (!successActive) return;
    setSuccessSecondsLeft(SUCCESS_SECONDS);
    const startedAt = Date.now();
    const tick = window.setInterval(() => {
      const left = Math.max(0, SUCCESS_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
      setSuccessSecondsLeft(left);
      if (left <= 0) {
        window.clearInterval(tick);
        continueAfterSuccess();
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [successActive, continueAfterSuccess]);

  // Once the result is safely recorded, head back to the exams list (longer on a pass
  // to enjoy the moment). We never navigate away while the result is still unsent.
  React.useEffect(() => {
    if (status === "in_progress") return;
    if (!resultSaved) return;
    const t = window.setTimeout(() => {
      navigate("/exams");
    }, status === "passed" ? 7000 : 3500);
    return () => window.clearTimeout(t);
  }, [status, resultSaved, navigate]);

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

  const retryFinalize = React.useCallback(() => {
    const args = resultArgsRef.current;
    if (!args) return;
    finalizeRef.current.mutate(args);
  }, []);

  if (!attemptId || !examId) return null;

  // With a result pending delivery the board is irrelevant — fall through to the verdict
  // dialog below, which carries the retry UI.
  if (!pendingResult) {
    if (attemptQuery.isPending) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-500 shadow-sm">
          Yuklanmoqda…
        </div>
      );
    }
    if (attemptQuery.isError || !attempt) {
      const message =
        attemptQuery.error instanceof Error && attemptQuery.error.message
          ? attemptQuery.error.message
          : "Urinish ma'lumotini yuklab bo'lmadi.";
      return (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {message}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => void attemptQuery.refetch()}>Qayta urinish</Button>
            <Button asChild variant="secondary">
              <Link to={`/exams/${examId}`}>Imtihonga qaytish</Link>
            </Button>
          </div>
        </div>
      );
    }
  }

  const boardOrientation: "white" | "black" = puzzle?.studentSide ?? "white";
  const studentsTurn =
    !!puzzle &&
    status === "in_progress" &&
    moveIdx < puzzle.moves.length &&
    isStudentMoveAtIndex(puzzle, moveIdx);
  // While reviewing a mistake or celebrating a solve the per-move timer is paused; show the
  // relevant countdown instead.
  const timerSeconds = reviewActive
    ? reviewSecondsLeft
    : successActive
      ? successSecondsLeft
      : secondsLeft;
  const timerTone = reviewActive
    ? "text-rose-600"
    : successActive
      ? "text-emerald-600"
      : secondsLeft <= 3
        ? "text-red-600"
        : secondsLeft <= 10
          ? "text-amber-600"
          : "text-slate-700";
  const studentName = getAuthUser()?.login?.trim() || "";
  const isLastPuzzle = puzzleIdx + 1 >= totalPuzzles;

  return (
    <div className="space-y-3">
      {puzzle ? (
        <>
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
              ) : successActive ? (
                <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-500">
                  Ajoyib!
                </span>
              ) : null}
              <div className="flex items-center gap-1.5">
                <Timer className={`h-4 w-4 ${timerTone} ${reviewActive || successActive ? "animate-pulse" : ""}`} />
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
              {status !== "in_progress" || reviewActive || successActive
                ? null
                : studentsTurn
                  ? "Yurishingizni qiling"
                  : "Raqib yurmoqda…"}
            </div>
          </div>
        </>
      ) : null}

      {status === "in_progress" && successActive ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
          <div className="flex items-start gap-2">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-emerald-800">To'g'ri yechildi! 🎉</div>
              <div className="mt-0.5 text-xs text-emerald-700">
                Keyingi pazlga {successSecondsLeft}s dan so'ng o'tiladi.
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={continueAfterSuccess}>
              Keyingi pazl
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

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
              {resultSaved ? (
                <div className="mt-2 text-xs text-slate-500">
                  Imtihonlar sahifasiga qaytilyapti…
                </div>
              ) : null}
            </div>

            {/* The result only counts once the server has it — never leave silently. */}
            {!resultSaved ? (
              <div
                className={`mt-3 rounded-lg border p-2 text-xs ${
                  finalizeMutation.isError
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {finalizeMutation.isError ? (
                  <>
                    <div className="font-semibold">Natija saqlanmadi</div>
                    <div className="mt-0.5">
                      Internet aloqasi yo'qdek. Natija shu qurilmada saqlandi — aloqa
                      tiklanganda qayta yuboring.
                    </div>
                    <Button size="sm" className="mt-2 w-full" onClick={retryFinalize}>
                      Qayta yuborish
                    </Button>
                  </>
                ) : (
                  <div className="text-center">Natija saqlanmoqda…</div>
                )}
              </div>
            ) : null}

            <div className="mt-4 flex justify-center">
              <Button
                size="sm"
                variant="secondary"
                disabled={finalizeMutation.isPending}
                onClick={() => navigate("/exams")}
              >
                {resultSaved ? "Hoziroq qaytish" : "Baribir qaytish"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
