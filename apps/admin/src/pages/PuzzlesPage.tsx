import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BaseChessboard, Button, TruncatedText } from "@shaxmatchi/ui";
import { Chess, type Square } from "chess.js";
import type { PieceDropHandlerArgs } from "react-chessboard";
import {
  adminDebutsApi,
  type Puzzle,
  type PuzzleMove,
} from "../api/adminDebutsApi";
import { AdminBreadcrumb } from "../components/AdminBreadcrumb";
import { debutsUi } from "../components/debuts/debutsUi";
import { LoadingCard } from "../components/loading";
import { ArrowLeft, BookOpen, Repeat, Dumbbell, ChevronLeft, ChevronRight, CheckCircle, RotateCcw, Settings2 } from "lucide-react";

function formatMoveNumber(idx: number) {
  const moveNo = Math.floor(idx / 2) + 1;
  const isWhite = idx % 2 === 0;
  return isWhite ? `${moveNo}.` : `${moveNo}...`;
}

function normalizeExplanationHtml(html: string): string {
  // Quill/copy-paste can save words with non-breaking spaces, which prevents wrapping.
  return html.replace(/(&nbsp;|&#160;|\u00a0)/gi, " ");
}

export function PuzzlePracticePage() {
  const navigate = useNavigate();
  const params = useParams();
  const levelId = params.levelId;
  const courseId = params.courseId;
  const moduleId = params.moduleId;
  const taskId = params.taskId;
  const puzzleId = params.puzzleId;
  if (!levelId || !courseId || !moduleId || !taskId || !puzzleId) {
    return <div className="text-sm text-slate-600">Missing params</div>;
  }

  const levelIdSafe: string = levelId;
  const courseIdSafe: string = courseId;
  const moduleIdSafe: string = moduleId;
  const taskIdSafe: string = taskId;
  const puzzleIdSafe: string = puzzleId;

  const [game, setGame] = React.useState(() => new Chess());
  const [mode, setMode] = React.useState<
    "study" | "repeat" | "practice" | null
  >(null);
  const autoplayRef = React.useRef<number | null>(null);
  const practiceBoardWrapRef = React.useRef<HTMLDivElement>(null);
  const [moveIdx, setMoveIdx] = React.useState(0);

  const fen = game.fen();

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
        taskIdSafe
      ),
  });

  const loading =
    levelsQuery.isLoading ||
    coursesQuery.isLoading ||
    modulesQuery.isLoading ||
    tasksQuery.isLoading ||
    puzzlesQuery.isLoading;

  const levelName =
    levelsQuery.data?.find((l) => l.id === levelIdSafe)?.name ?? "Debyut daraja";
  const courseName =
    coursesQuery.data?.find((c) => c.id === courseIdSafe)?.name ?? "Kurs";
  const moduleName =
    modulesQuery.data?.find((m) => m.id === moduleIdSafe)?.name ?? "Modul";
  const taskName =
    tasksQuery.data?.find((t) => t.id === taskIdSafe)?.name ?? "Vazifa";

  const puzzle: Puzzle | undefined = puzzlesQuery.data?.find(
    (p) => p.id === puzzleIdSafe
  );
  const moves: PuzzleMove[] = Array.isArray(puzzle?.moves)
    ? (puzzle!.moves as PuzzleMove[])
    : [];

  const stopAutoplay = React.useCallback(() => {
    if (autoplayRef.current) {
      window.clearInterval(autoplayRef.current);
      autoplayRef.current = null;
    }
  }, []);

  const startAutoplay = React.useCallback(() => {
    stopAutoplay();
    setMoveIdx(0);
    setGame(new Chess());

    let step = 0;
    autoplayRef.current = window.setInterval(() => {
      step += 1;
      const g = new Chess();
      for (let i = 0; i < step && i < moves.length; i++) g.move(moves[i].san);
      setGame(g);
      setMoveIdx(step);
      if (step >= moves.length) {
        stopAutoplay();
        setMode(null);
      }
    }, 700);
  }, [moves, stopAutoplay]);

  const setBoardToMove = React.useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(moves.length, idx));
      const g = new Chess();
      for (let i = 0; i < clamped; i++) g.move(moves[i].san);
      setGame(g);
      setMoveIdx(clamped);
    },
    [moves]
  );

  const startPractice = React.useCallback(() => {
    stopAutoplay();
    setMode("practice");
    setGame(new Chess());
    setMoveIdx(0);
  }, [stopAutoplay]);

  const isPracticeComplete = mode === "practice" && moveIdx >= moves.length;
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
      if (moveIdx >= moves.length) return false;

      const next = new Chess(fen);
      const move = next.move({ from, to, promotion: "q" });
      if (!move) {
        triggerWrongPracticeFeedback();
        return false;
      }
      const expectedSan = moves[moveIdx]?.san;
      if (!expectedSan || move.san !== expectedSan) {
        triggerWrongPracticeFeedback();
        return false;
      }
      setGame(next);
      setMoveIdx((i) => i + 1);
      return true;
    },
    [fen, moveIdx, moves, triggerWrongPracticeFeedback]
  );

  React.useEffect(() => () => stopAutoplay(), [stopAutoplay]);

  if (loading) {
    return <LoadingCard title="Variant yuklanmoqda…" lines={4} compact />;
  }

  if (!puzzle) {
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
            {
              label: "Variantlar",
              to: `/debuts/levels/${levelIdSafe}/courses/${courseIdSafe}/modules/${moduleIdSafe}/tasks/${taskIdSafe}/puzzles`,
            },
            { label: "Mashq" },
          ]}
        />
        <div className={`${debutsUi.card} p-3 sm:p-4`}>
          <div className="text-sm font-semibold">Variant topilmadi</div>
          <div className="mt-0.5 text-xs text-slate-600">Variantlar ro'yxatiga qaytish.</div>
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={() => navigate(-1)}>
              Orqaga
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={debutsUi.page}>
      {mode === null ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="text-sm font-semibold">Rejimni tanlang</div>
            <div className="mt-1 text-sm text-slate-600">
              Qanday mashq qilmoqchisiz?
            </div>
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
          {
            label: taskName,
            to: `/debuts/levels/${levelIdSafe}/courses/${courseIdSafe}/modules/${moduleIdSafe}/tasks`,
          },
          {
            label: "Variantlar",
            to: `/debuts/levels/${levelIdSafe}/courses/${courseIdSafe}/modules/${moduleIdSafe}/tasks/${taskIdSafe}/puzzles`,
          },
          { label: puzzle.name },
        ]}
      />

      <div className={`${debutsUi.card} p-2.5 sm:p-3`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              <div className="min-w-0">
                <TruncatedText text={puzzle.name} maxLines={2} className="font-semibold text-inherit" />
              </div>
            </h1>
            <div className="mt-0.5 text-xs text-slate-500">{moves.length} yurish</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Orqaga
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                stopAutoplay();
                setMode(null);
              }}
            >
              <Settings2 className="mr-1 h-4 w-4" /> Rejimni o'zgartirish
            </Button>
          </div>
        </div>
      </div>

      <div className={`${debutsUi.card} p-2.5 sm:p-3`}>
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
              onPieceDrop:
                mode === "practice" ? onPracticePieceDrop : undefined,
            }}
          />
        </div>

        {mode === "study" ? (
          <div className="mt-5 flex items-center justify-between gap-3 px-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setBoardToMove(moveIdx - 1)}
              disabled={moveIdx <= 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-xs text-slate-500">
              Qadam <span className="font-mono">{moveIdx}</span>/
              <span className="font-mono">{moves.length}</span>
            </div>
            {moveIdx >= moves.length ? (
              <Button size="sm" onClick={() => setMode(null)}>
                <CheckCircle className="mr-1 h-4 w-4" /> Tugatish
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setBoardToMove(moveIdx + 1)}
                disabled={moveIdx >= moves.length}
              >
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
                  Yurish {Math.min(moveIdx, moves.length)}:{" "}
                  {moves[Math.min(moveIdx, moves.length) - 1]?.san}
                </div>
                <div className="mt-2 font-mono text-xs text-slate-600">
                  {moves.map((m) => m.san).join(" ")}
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
              <div>Birinchi yurishni ko‘rsatish uchun “Keyingi” ni bosing.</div>
            ) : (
              <>
                <div className="font-mono text-xs text-slate-500">
                  Yurish {moveIdx}: {moves[moveIdx - 1]?.san}
                </div>
                <div
                  className="mt-2"
                  dangerouslySetInnerHTML={{
                    __html: normalizeExplanationHtml(moves[moveIdx - 1]?.explanation ?? ""),
                  }}
                />
              </>
            )}
          </div>
        </div>
      ) : null}

      {mode === "practice" && isPracticeComplete ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 shadow-sm sm:p-4">
          Mashq tugadi.
        </div>
      ) : null}
    </div>
  );
}
