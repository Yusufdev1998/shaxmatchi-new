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
import { BookOpen, Repeat, Dumbbell, ChevronLeft, ChevronRight, CheckCircle, RotateCcw } from "lucide-react";
import { studentDebutsApi, type PuzzleMove } from "../api/studentDebutsApi";
import { playMoveSound } from "../lib/playMoveSound";

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
      setGame(new Chess());
      setMode(null);
      setMoveIdx(0);
      stopAutoplay();
      return;
    }
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
  }, [id, puzzle, stopAutoplay]);

  const startRepeat = React.useCallback(() => {
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

  const handlePracticeFailure = React.useCallback(() => {
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
      .consumePracticeAttempt(id)
      .catch(() => undefined)
      .then(async () => {
        await queryClient.invalidateQueries({ queryKey: ["studentDebuts", "hierarchy"] });
        return puzzleQuery.refetch();
      })
      .finally(() => {
        setIsPracticeResetting(false);
      });
  }, [id, puzzleQuery, queryClient, stopAutoplay, triggerWrongPracticeFeedback]);

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
        handlePracticeFailure();
        return false;
      }

      const expectedSan = puzzleMoves[moveIdx]?.san;
      if (!expectedSan || move.san !== expectedSan) {
        handlePracticeFailure();
        return false;
      }

      playMoveSound();
      setGame(next);
      setMoveIdx((i) => i + 1);
      return true;
    },
    [fen, handlePracticeFailure, isPracticeResetting, moveIdx, puzzle, puzzleMoves],
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

      playMoveSound();
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
      playMoveSound();
      setGame(next);
      setMoveIdx((i) => i + 1);
    }, 450);
  }, [puzzle, fen, mode, moveIdx, puzzleMoves, stopAutoplay]);

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
    if (mode === "practice" && isPracticeLimitReached) {
      triggerLimitRedirect();
    }
  }, [isPracticeLimitReached, mode, triggerLimitRedirect]);

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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-sm rounded-xl border border-white/25 bg-slate-900/90 p-5 text-center text-white shadow-2xl">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-2 border-white/35 border-t-white" />
            <div className="text-base font-semibold">Xato urinish</div>
            <div className="mt-1 text-sm text-slate-200">
              Mashq boshidan boshlanadi.
            </div>
            <div className="mt-3 text-xs text-slate-300">Yangilanmoqda...</div>
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
                  onClick={() => setMode("practice")}
                  disabled={isPracticeLimitReached}
                >
                  <Dumbbell className="mr-2 h-4 w-4" /> Mashq
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => {
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
            options={{
              position: fen,
              onPieceDrop: mode === "practice" ? onPracticePieceDrop : mode === "repeat" ? onRepeatPieceDrop : undefined,
            }}
          />
        </div>

        {mode === "study" ? (
          <div className="mt-5 flex items-center justify-between gap-3 px-1">
            <Button size="sm" variant="secondary" onClick={() => setBoardToMove(moveIdx - 1)} disabled={moveIdx <= 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-xs text-slate-500">
              Qadam <span className="font-mono">{moveIdx}</span>/
              <span className="font-mono">{puzzleMoves.length}</span>
            </div>
            {moveIdx >= puzzleMoves.length ? (
              <Button size="sm" onClick={() => setMode(null)}>
                <CheckCircle className="mr-1 h-4 w-4" /> Tugatish
              </Button>
            ) : (
              <Button size="sm" onClick={() => setBoardToMove(moveIdx + 1)} disabled={moveIdx >= puzzleMoves.length}>
                <ChevronRight className="h-4 w-4" />
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
