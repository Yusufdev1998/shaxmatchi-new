import * as React from "react";
import { Chess, type Square } from "chess.js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BaseChessboard,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  TruncatedText,
} from "@shaxmatchi/ui";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import type { PieceDropHandlerArgs } from "react-chessboard";
import {
  BookOpen,
  Repeat,
  Dumbbell,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { studentDebutsApi, type PuzzleMove } from "../api/studentDebutsApi";
import {
  playAchievementSound,
  playFailSound,
  playGameStartSound,
  playMoveSound,
} from "../lib/playSounds";

function assignmentModeTitle(mode: "new" | "test"): string {
  return mode === "test" ? "Mashq" : "O'rganish";
}

type PuzzleStudentSide = "white" | "black";

/** Line index 0 = White from initial position; student may play white or black indices. */
function isStudentMoveAtIndex(side: PuzzleStudentSide, moveIdx: number): boolean {
  return side === "white" ? moveIdx % 2 === 0 : moveIdx % 2 === 1;
}

function isOpponentMoveAtIndex(side: PuzzleStudentSide, moveIdx: number): boolean {
  return !isStudentMoveAtIndex(side, moveIdx);
}

function normalizeExplanationHtml(html: string): string {
  // Quill/copy-paste can save words with non-breaking spaces, which prevents wrapping.
  return html.replace(/(&nbsp;|&#160;|\u00a0)/gi, " ");
}

export function PuzzlePage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const puzzleQuery = useQuery({
    queryKey: ["studentPuzzles", "puzzle", id],
    queryFn: () => studentDebutsApi.getPuzzle(id!),
    enabled: Boolean(id),
  });

  const puzzle = puzzleQuery.data;
  const puzzleMoves: PuzzleMove[] = Array.isArray(puzzle?.moves) ? puzzle.moves : [];

  const [game, setGame] = React.useState(() => new Chess());
  const [mode, setMode] = React.useState<"study" | "repeat" | "practice" | null>(null);
  const autoplayRef = React.useRef<number | null>(null);
  const limitRedirectTimerRef = React.useRef<number | null>(null);
  const skipNextModeSelectionRef = React.useRef(false);
  /** Avoid resetting board/mode when the same variant refetches (e.g. after consume-attempt). */
  const loadedPuzzleIdRef = React.useRef<string | null>(null);
  const practiceBoardWrapRef = React.useRef<HTMLDivElement>(null);
  const [moveIdx, setMoveIdx] = React.useState(0);
  const [isPracticeResetting, setIsPracticeResetting] = React.useState(false);
  const [isLimitRedirecting, setIsLimitRedirecting] = React.useState(false);

  const fen = game.fen();

  const stopAutoplay = React.useCallback(() => {
    if (autoplayRef.current) {
      window.clearInterval(autoplayRef.current);
      autoplayRef.current = null;
    }
  }, []);

  const triggerLimitRedirect = React.useCallback(() => {
    if (limitRedirectTimerRef.current !== null) return;
    stopAutoplay();
    setIsLimitRedirecting(true);
    void queryClient.invalidateQueries({ queryKey: ["studentDebuts", "hierarchy"] });
    const state = location.state as { returnTo?: string } | null;
    const returnTo =
      typeof state?.returnTo === "string" && state.returnTo.length > 0
        ? state.returnTo
        : "/debut";
    limitRedirectTimerRef.current = window.setTimeout(() => {
      navigate(returnTo, { replace: true });
    }, 1300);
  }, [location.state, navigate, queryClient, stopAutoplay]);

  React.useEffect(() => {
    if (!id) return;
    if (!puzzle) {
      loadedPuzzleIdRef.current = null;
      setGame(new Chess());
      setMode(null);
      setMoveIdx(0);
      stopAutoplay();
      return;
    }
    if (puzzle.id !== id) return;

    const firstLoadForThisPuzzle = loadedPuzzleIdRef.current !== puzzle.id;
    if (firstLoadForThisPuzzle) {
      loadedPuzzleIdRef.current = puzzle.id;
      setGame(new Chess());
      setMoveIdx(0);
      stopAutoplay();
      if (skipNextModeSelectionRef.current && puzzle.mode === "test") {
        skipNextModeSelectionRef.current = false;
        setMode("practice");
      } else {
        // Always ask the student to pick the allowed mode when opening a variant.
        setMode(null);
      }
    } else if (skipNextModeSelectionRef.current && puzzle.mode === "test") {
      skipNextModeSelectionRef.current = false;
      setMode("practice");
    }
  }, [id, puzzle, stopAutoplay]);

  const startRepeat = React.useCallback(() => {
    playGameStartSound();
    stopAutoplay();
    setMoveIdx(0);
    setGame(new Chess());
    setMode("repeat");
  }, [stopAutoplay]);

  const setBoardToMove = React.useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(puzzleMoves.length, idx));
      const g = new Chess();
      for (let i = 0; i < clamped; i++) {
        g.move(puzzleMoves[i].san);
      }
      setGame(g);
      setMoveIdx(clamped);
    },
    [puzzleMoves],
  );

  const isPracticeComplete = mode === "practice" && moveIdx >= puzzleMoves.length;
  const isLocked = mode !== "practice" || isPracticeComplete;

  const triggerWrongPracticeFeedback = React.useCallback(() => {
    playFailSound();
    try {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([35, 45, 35]);
      }
    } catch {
      /* ignore */
    }
    const el = practiceBoardWrapRef.current;
    if (!el) return;
    el.classList.remove("animate-board-shake");
    void el.offsetWidth;
    el.classList.add("animate-board-shake");
  }, []);

  const restartPractice = React.useCallback(() => {
    playGameStartSound();
    stopAutoplay();
    setMoveIdx(0);
    setGame(new Chess());
  }, [stopAutoplay]);

  const goBackToVariantsList = React.useCallback(() => {
    const state = location.state as { returnTo?: string } | null;
    const returnTo =
      typeof state?.returnTo === "string" && state.returnTo.length > 0
        ? state.returnTo
        : "/debut";
    navigate(returnTo, { replace: true });
  }, [location.state, navigate]);

  const handlePracticeFailure = React.useCallback((failureMoveIndex: number) => {
    triggerWrongPracticeFeedback();
    stopAutoplay();
    setGame(new Chess());
    setMoveIdx(0);
    // In mashq mode, each failed attempt consumes one try.
    setIsPracticeResetting(true);
    skipNextModeSelectionRef.current = true;
    if (!id) {
      setIsPracticeResetting(false);
      return;
    }
    void studentDebutsApi
      .consumePracticeAttempt(id, { outcome: "failure", failureMoveIndex })
      .catch(() => undefined)
      .then(async () => {
        await queryClient.invalidateQueries({ queryKey: ["studentDebuts", "hierarchy"] });
        return puzzleQuery.refetch();
      })
      .finally(() => {
        setIsPracticeResetting(false);
      });
  }, [id, puzzleQuery, queryClient, stopAutoplay, triggerWrongPracticeFeedback]);

  /** Each full mashq (success or failure) consumes one urinish; refetch so UI shows updated count. */
  const handlePracticeLineCompleted = React.useCallback(() => {
    if (!id) return;
    if (puzzle?.mode !== "test") return;
    // Refetch updates `puzzle` and retriggers the effect below; keep mashq open like after a wrong move.
    skipNextModeSelectionRef.current = true;
    void studentDebutsApi
      .consumePracticeAttempt(id, { outcome: "success" })
      .catch(() => undefined)
      .then(async () => {
        await queryClient.invalidateQueries({ queryKey: ["studentDebuts", "hierarchy"] });
        return puzzleQuery.refetch();
      });
  }, [id, puzzle?.mode, puzzleQuery, queryClient]);

  const onPracticePieceDrop = React.useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
      if (!targetSquare) return false;
      if (isPracticeResetting) return false;
      if (
        puzzle?.mode === "test" &&
        typeof puzzle.practiceLimit === "number" &&
        typeof puzzle.practiceAttemptsUsed === "number" &&
        puzzle.practiceAttemptsUsed >= puzzle.practiceLimit
      ) {
        return false;
      }
      const from = sourceSquare as Square;
      const to = targetSquare as Square;
      if (moveIdx >= puzzleMoves.length) return false;
      const side: PuzzleStudentSide = puzzle?.studentSide === "black" ? "black" : "white";
      if (!isStudentMoveAtIndex(side, moveIdx)) return false;

      const next = new Chess(fen);
      const move = next.move({ from, to, promotion: "q" });
      if (!move) {
        handlePracticeFailure(moveIdx);
        return false;
      }

      const expectedSan = puzzleMoves[moveIdx]?.san;
      if (!expectedSan || move.san !== expectedSan) {
        handlePracticeFailure(moveIdx);
        return false;
      }

      const completesLine = moveIdx + 1 >= puzzleMoves.length;
      if (completesLine) {
        playAchievementSound();
        handlePracticeLineCompleted();
      } else {
        playMoveSound();
      }
      setGame(next);
      setMoveIdx((i) => i + 1);
      return true;
    },
    [fen, handlePracticeFailure, handlePracticeLineCompleted, isPracticeResetting, moveIdx, puzzle, puzzleMoves],
  );

  const onRepeatPieceDrop = React.useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
      if (!targetSquare) return false;
      if (mode !== "repeat") return false;
      if (moveIdx >= puzzleMoves.length) return false;
      const side: PuzzleStudentSide = puzzle?.studentSide === "black" ? "black" : "white";
      if (!isStudentMoveAtIndex(side, moveIdx)) return false;

      const from = sourceSquare as Square;
      const to = targetSquare as Square;
      const next = new Chess(fen);
      const move = next.move({ from, to, promotion: "q" });
      if (!move) {
        triggerWrongPracticeFeedback();
        return false;
      }

      const expectedSan = puzzleMoves[moveIdx]?.san;
      if (!expectedSan || move.san !== expectedSan) {
        triggerWrongPracticeFeedback();
        return false;
      }

      const completesLine = moveIdx + 1 >= puzzleMoves.length;
      if (completesLine) {
        playAchievementSound();
      } else {
        playMoveSound();
      }
      setGame(next);
      setMoveIdx((i) => i + 1);
      return true;
    },
    [fen, mode, moveIdx, puzzle, puzzleMoves, triggerWrongPracticeFeedback],
  );

  React.useEffect(() => {
    if (!puzzle) return;
    if (mode !== "repeat" && mode !== "practice") return;
    if (moveIdx >= puzzleMoves.length) return;
    const side: PuzzleStudentSide = puzzle.studentSide === "black" ? "black" : "white";
    if (!isOpponentMoveAtIndex(side, moveIdx)) return;
    stopAutoplay();
    autoplayRef.current = window.setTimeout(() => {
      const expectedSan = puzzleMoves[moveIdx]?.san;
      if (!expectedSan) return;
      const next = new Chess(fen);
      const move = next.move(expectedSan);
      if (!move) return;
      const completesLine = moveIdx + 1 >= puzzleMoves.length;
      if (completesLine) {
        playAchievementSound();
        if (mode === "practice") {
          handlePracticeLineCompleted();
        }
      } else {
        playMoveSound();
      }
      setGame(next);
      setMoveIdx((i) => i + 1);
    }, 450);
  }, [handlePracticeLineCompleted, mode, puzzle, fen, moveIdx, puzzleMoves, stopAutoplay]);

  React.useEffect(() => () => stopAutoplay(), [stopAutoplay]);
  React.useEffect(
    () => () => {
      if (limitRedirectTimerRef.current !== null) {
        window.clearTimeout(limitRedirectTimerRef.current);
      }
    },
    [],
  );

  const practiceAttemptsUsed =
    typeof puzzle?.practiceAttemptsUsed === "number" ? puzzle.practiceAttemptsUsed : null;
  const practiceLimit =
    typeof puzzle?.practiceLimit === "number" ? puzzle.practiceLimit : null;
  const isPracticeLimitReached =
    puzzle?.mode === "test" &&
    practiceLimit !== null &&
    practiceAttemptsUsed !== null &&
    practiceAttemptsUsed >= practiceLimit;

  React.useEffect(() => {
    const rawError: unknown = puzzleQuery.error;
    const errMsg = rawError instanceof Error ? rawError.message.toLowerCase() : "";
    if (errMsg.includes("limiti tugagan")) {
      triggerLimitRedirect();
    }
  }, [puzzleQuery.error, triggerLimitRedirect]);

  React.useEffect(() => {
    // Limit reached after a wrong move: redirect. After a successful finish, stay on the completion dialog.
    if (mode === "practice" && isPracticeLimitReached && !isPracticeComplete) {
      triggerLimitRedirect();
    }
  }, [isPracticeComplete, isPracticeLimitReached, mode, triggerLimitRedirect]);

  const learningFlushRef = React.useRef<number>(Date.now());

  React.useEffect(() => {
    if (!id || puzzle?.mode !== "new") return;
    if (mode !== "study" && mode !== "repeat") return;

    learningFlushRef.current = Date.now();

    const flush = (opts: { force?: boolean }) => {
      const force = opts.force ?? false;
      if (!force && document.visibilityState !== "visible") return;
      const now = Date.now();
      const raw = Math.floor((now - learningFlushRef.current) / 1000);
      const delta = Math.min(120, Math.max(0, raw));
      if (delta < 1) return;
      learningFlushRef.current = now;
      void studentDebutsApi.addLearningSeconds(id, { deltaSeconds: delta }).catch(() => undefined);
    };

    const intervalId = window.setInterval(() => flush({}), 15000);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flush({ force: true });
      } else {
        learningFlushRef.current = Date.now();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
      flush({ force: true });
    };
  }, [id, puzzle?.mode, mode]);

  if (!id) {
    return <div className="text-sm text-slate-600">Variant id topilmadi</div>;
  }

  if (puzzleQuery.isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm sm:p-4">
        Variant yuklanmoqda...
      </div>
    );
  }

  if (puzzleQuery.error || !puzzle) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="text-sm font-semibold">Variant qulflangan</div>
        <div className="mt-1 text-sm text-slate-600">
          Bu variant sizga hali tayinlanmagan yoki mashq urinishlar limiti tugagan.
        </div>
      </div>
    );
  }

  const isTestAssignment = puzzle.mode === "test";
  const studentSide: PuzzleStudentSide = puzzle.studentSide === "black" ? "black" : "white";
  const isRepeatComplete = mode === "repeat" && moveIdx >= puzzleMoves.length;
  const isRepeatStudentTurn =
    mode === "repeat" && moveIdx < puzzleMoves.length && isStudentMoveAtIndex(studentSide, moveIdx);
  const isPracticeStudentTurn =
    mode === "practice" && moveIdx < puzzleMoves.length && isStudentMoveAtIndex(studentSide, moveIdx);
  const isPracticeBoardLocked = isLocked || isPracticeResetting;

  const studyBoardShapes =
    mode === "study" && moveIdx > 0 ? puzzleMoves[moveIdx - 1] : null;

  return (
    <div className="space-y-3">
      {isLimitRedirecting ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/20 bg-slate-900/95 p-5 text-center text-white shadow-2xl">
            <div className="text-base font-semibold">Sizning urinishlaringiz tugadi!</div>
            <div className="mt-2 text-sm text-slate-200">Variantlar sahifasiga qaytilmoqda...</div>
          </div>
        </div>
      ) : null}

      {mode === "practice" && isPracticeResetting ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div
            role="alert"
            className="w-full max-w-sm rounded-2xl border border-rose-200/90 bg-gradient-to-b from-white to-rose-50/90 p-6 text-center shadow-2xl ring-1 ring-rose-500/10"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600 shadow-inner">
              <XCircle className="h-8 w-8" strokeWidth={2} aria-hidden />
            </div>
            <div className="text-base font-semibold text-slate-900">Xato urinish</div>
            <div className="mt-1.5 text-sm text-slate-600">Mashq boshidan boshlanadi.</div>
            <div className="mt-4 text-xs text-slate-500">Yangilanmoqda...</div>
          </div>
        </div>
      ) : null}

      {mode === "practice" && isPracticeComplete && !isPracticeResetting ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="practice-complete-title"
            className="w-full max-w-md rounded-2xl border border-emerald-200/90 bg-gradient-to-b from-white to-emerald-50/95 p-6 shadow-2xl ring-1 ring-emerald-500/15"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
              <CheckCircle className="h-9 w-9" strokeWidth={2} aria-hidden />
            </div>
            <h2 id="practice-complete-title" className="text-center text-xl font-bold tracking-tight text-slate-900">
              Mashq muvaffaqiyatli yakunlandi
            </h2>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button type="button" className="w-full sm:flex-1" onClick={restartPractice}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Qayta mashq qilish
              </Button>
              <Button type="button" variant="secondary" className="w-full sm:flex-1" onClick={goBackToVariantsList}>
                Variantlar sahifasiga
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {mode === null ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="text-sm font-semibold">Rejimni tanlang</div>
            <div className="mt-1 text-sm text-slate-600">Nima qilmoqchisiz?</div>
            <div className="mt-4 grid gap-2">
              {isTestAssignment ? (
                <Button
                  onClick={() => {
                    playGameStartSound();
                    setMode("practice");
                  }}
                  disabled={isPracticeLimitReached}
                >
                  <Dumbbell className="mr-2 h-4 w-4" /> Mashq
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => {
                      playGameStartSound();
                      stopAutoplay();
                      setMode("study");
                      setBoardToMove(0);
                    }}
                  >
                    <BookOpen className="mr-2 h-4 w-4" /> Yurishlarni o'rganish
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      startRepeat();
                    }}
                  >
                    <Repeat className="mr-2 h-4 w-4" /> Yurishlarni takrorlash
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/debut">Debyutlar</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Variant</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <h1 className="min-w-0 flex-1 text-lg font-semibold tracking-tight sm:text-xl">
            <TruncatedText text={puzzle.name} maxLines={3} className="font-semibold text-inherit" />
          </h1>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 text-sm text-slate-600"
            title={assignmentModeTitle(puzzle.mode)}
          >
            <span className="text-slate-500">Rejim:</span>
            {puzzle.mode === "test" ? (
              <Dumbbell className="h-4 w-4 text-slate-800" aria-hidden />
            ) : (
              <BookOpen className="h-4 w-4 text-slate-800" aria-hidden />
            )}
            <span className="sr-only">{assignmentModeTitle(puzzle.mode)}</span>
            {puzzle.mode === "test" && practiceAttemptsUsed !== null ? (
              <>
                {" · "}
                Urinishlar:{" "}
                <span className="font-mono text-xs">
                  {practiceAttemptsUsed}
                  {practiceLimit !== null ? `/${practiceLimit}` : ""}
                </span>
              </>
            ) : null}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-3">
        <div
          ref={practiceBoardWrapRef}
          className={`mb-2 origin-center will-change-transform ${
            mode === "practice"
              ? isPracticeBoardLocked ||
                  isPracticeLimitReached ||
                  !isPracticeStudentTurn
                ? "pointer-events-none select-none"
                : ""
              : mode === "repeat"
                ? isRepeatStudentTurn
                  ? ""
                  : "pointer-events-none select-none"
                : "pointer-events-none select-none"
          }`}
          onAnimationEnd={(e) => {
            if (!e.animationName.includes("board-shake")) return;
            e.currentTarget.classList.remove("animate-board-shake");
          }}
        >
          <BaseChessboard
            circles={studyBoardShapes?.circles}
            arrows={studyBoardShapes?.arrows}
            options={{
              position: fen,
              onPieceDrop: mode === "practice" ? onPracticePieceDrop : mode === "repeat" ? onRepeatPieceDrop : undefined,
            }}
          />
        </div>

        {mode === "study" ? (
          <div className="mt-5 flex items-center justify-between gap-1.5  px-0.5 pt-2 sm:mt-6 sm:gap-2 sm:pt-5">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 shrink-0 gap-0 rounded-md px-1.5 text-xs font-medium leading-none sm:px-2"
              onClick={() => setBoardToMove(moveIdx - 1)}
              disabled={moveIdx <= 0}
            >
              <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="-ml-0.5">oldingi</span>
            </Button>
            <div className="min-w-0 flex-1 text-center text-[11px] text-slate-500 sm:text-xs">
              Qadam <span className="font-mono">{moveIdx}</span>/
              <span className="font-mono">{puzzleMoves.length}</span>
            </div>
            {moveIdx >= puzzleMoves.length ? (
              <Button
                size="sm"
                className="h-7 shrink-0 gap-1 rounded-md px-2 text-xs font-medium leading-none"
                onClick={() => setMode(null)}
              >
                <CheckCircle className="h-3.5 w-3.5 shrink-0" aria-hidden /> Tugatish
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-7 shrink-0 gap-0 rounded-md px-1.5 text-xs font-medium leading-none sm:px-2"
                onClick={() => setBoardToMove(moveIdx + 1)}
                disabled={moveIdx >= puzzleMoves.length}
              >
                <span className="-mr-0.5">keyingi</span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </Button>
            )}
          </div>
        ) : null}
        {mode === "practice" && isPracticeLimitReached ? (
          <div className="mt-2 text-xs text-red-700">Mashq urinishlar limiti tugagan.</div>
        ) : null}
      </div>

      {mode === "repeat" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Yurishlar</div>
            <Button size="sm" variant="secondary" onClick={startRepeat}>
              <RotateCcw className="mr-1 h-4 w-4" /> Replay
            </Button>
          </div>
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {isRepeatComplete ? <div>Takrorlash yakunlandi.</div> : null}
            {mode === "repeat" && !isRepeatComplete ? (
              <div className="text-xs text-slate-500">
                Navbat: {isRepeatStudentTurn ? "siz" : "raqib (avtomatik)"}
              </div>
            ) : null}
            {moveIdx > 0 ? (
              <>
                <div className="font-mono text-xs text-slate-500">
                  Yurish {Math.min(moveIdx, puzzleMoves.length)}:{" "}
                  {puzzleMoves[Math.min(moveIdx, puzzleMoves.length) - 1]?.san}
                </div>
                <div className="mt-2 font-mono text-xs text-slate-600">
                  {puzzleMoves.map((m) => m.san).join(" ")}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {mode === "study" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-2">
          <div className="text-sm font-semibold">Tushuntirish</div>
          <div className="mt-1 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
            {moveIdx === 0 ? (
              <div>Birinchi yurishni ko’rsatish uchun “Oldinga” ni bosing.</div>
            ) : (
              <>
                <div className="font-mono text-xs text-slate-500">
                  Yurish {moveIdx}: {puzzleMoves[moveIdx - 1]?.san}
                </div>
                <div
                  className="mt-2"
                  dangerouslySetInnerHTML={{
                    __html: normalizeExplanationHtml(puzzleMoves[moveIdx - 1]?.explanation ?? ""),
                  }}
                />
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
