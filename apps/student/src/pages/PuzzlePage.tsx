import * as React from "react";
import { Chess, type Square } from "chess.js";
import { useQuery } from "@tanstack/react-query";
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
import { Link, useParams } from "react-router-dom";
import { PieceDropHandlerArgs } from "react-chessboard";
import { BookOpen, Repeat, Dumbbell, ChevronLeft, ChevronRight, CheckCircle, RotateCcw } from "lucide-react";
import { studentDebutsApi, type PuzzleMove } from "../api/studentDebutsApi";

export function PuzzlePage() {
  const { id } = useParams();

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
  const practiceBoardWrapRef = React.useRef<HTMLDivElement>(null);
  const [moveIdx, setMoveIdx] = React.useState(0);

  const fen = game.fen();

  const stopAutoplay = React.useCallback(() => {
    if (autoplayRef.current) {
      window.clearInterval(autoplayRef.current);
      autoplayRef.current = null;
    }
  }, []);

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
    if (puzzle.mode === "test") {
      setMode("practice");
    } else {
      setMode(null);
    }
  }, [id, puzzle, stopAutoplay]);

  const startAutoplay = React.useCallback(() => {
    stopAutoplay();
    setMoveIdx(0);
    setGame(new Chess());

    let step = 0;
    autoplayRef.current = window.setInterval(() => {
      step += 1;
      const g = new Chess();
      for (let i = 0; i < step && i < puzzleMoves.length; i++) {
        g.move(puzzleMoves[i].san);
      }
      setGame(g);
      setMoveIdx(step);

      if (step >= puzzleMoves.length) {
        stopAutoplay();
        setMode(null);
      }
    }, 700);
  }, [puzzleMoves, stopAutoplay]);

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

  const startPractice = React.useCallback(() => {
    stopAutoplay();
    setMode("practice");
    setGame(new Chess());
    setMoveIdx(0);
  }, [stopAutoplay]);

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

  const onPracticePieceDrop = React.useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) => {
      if (!targetSquare) return false;
      const from = sourceSquare as Square;
      const to = targetSquare as Square;
      if (moveIdx >= puzzleMoves.length) return false;

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

      setGame(next);
      setMoveIdx((i) => i + 1);
      return true;
    },
    [fen, moveIdx, puzzleMoves, triggerWrongPracticeFeedback],
  );

  React.useEffect(() => () => stopAutoplay(), [stopAutoplay]);

  if (!id) {
    return <div className="text-sm text-slate-600">Pazl id topilmadi</div>;
  }

  if (puzzleQuery.isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm sm:p-4">
        Pazl yuklanmoqda...
      </div>
    );
  }

  if (puzzleQuery.error || !puzzle) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="text-sm font-semibold">Pazl qulflangan</div>
        <div className="mt-1 text-sm text-slate-600">
          Bu pazl sizga hali tayinlanmagan.
        </div>
      </div>
    );
  }

  const isTestAssignment = puzzle.mode === "test";

  return (
    <div className="space-y-3">
      {mode === null && !isTestAssignment ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="text-sm font-semibold">Rejimni tanlang</div>
            <div className="mt-1 text-sm text-slate-600">Nima qilmoqchisiz?</div>
            <div className="mt-4 grid gap-2">
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
                  setMode("repeat");
                  startAutoplay();
                }}
              >
                <Repeat className="mr-2 h-4 w-4" /> Yurishlarni takrorlash
              </Button>
              <Button variant="secondary" onClick={startPractice}>
                <Dumbbell className="mr-2 h-4 w-4" /> Mashq
              </Button>
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
            <BreadcrumbPage>Pazl</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          <div className="min-w-0">
            <TruncatedText text={puzzle.name} maxLines={3} className="font-semibold text-inherit" />
          </div>
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Pazl id: <span className="font-mono text-xs">{id ?? "unknown"}</span>
          {" · "}
          Rejim: <span className="font-mono text-xs">{puzzle.mode}</span>
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-3">
        <div
          ref={practiceBoardWrapRef}
          className={`mb-2 origin-center will-change-transform ${
            isLocked ? "pointer-events-none select-none" : ""
          }`}
          onAnimationEnd={(e) => {
            if (!e.animationName.includes("board-shake")) return;
            e.currentTarget.classList.remove("animate-board-shake");
          }}
        >
          <BaseChessboard
            options={{
              position: fen,
              onPieceDrop: mode === "practice" ? onPracticePieceDrop : undefined,
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
      </div>

      {mode === "repeat" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Yurishlar</div>
            <Button size="sm" variant="secondary" onClick={startAutoplay}>
              <RotateCcw className="mr-1 h-4 w-4" /> Replay
            </Button>
          </div>
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            {moveIdx === 0 ? <div>Boshlash uchun “Replay” ni bosing.</div> : null}
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
                    __html: puzzleMoves[moveIdx - 1]?.explanation ?? "",
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
