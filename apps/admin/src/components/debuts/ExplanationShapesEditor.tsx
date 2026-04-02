import * as React from "react";
import {
  BaseChessboard,
  type BaseChessboardArrow,
  baseChessboardArrowOptions,
  DEFAULT_EXPLANATION_SHAPE_COLOR,
  EXPLANATION_SHAPE_COLORS,
  type ExplanationShapeColor,
} from "@shaxmatchi/ui";
import { ArrowRight, Circle, Trash2 } from "lucide-react";

export type ExplanationCircle = { square: string; color: ExplanationShapeColor };

export type ExplanationShapes = {
  circles: ExplanationCircle[];
  arrows: BaseChessboardArrow[];
};

type Props = {
  fen: string;
  circles: ExplanationCircle[];
  arrows: BaseChessboardArrow[];
  onChange: (next: ExplanationShapes) => void;
};

export function ExplanationShapesEditor({ fen, circles, arrows, onChange }: Props) {
  const [tool, setTool] = React.useState<"circle" | "arrow">("circle");
  const [arrowStart, setArrowStart] = React.useState<string | null>(null);
  const [shapeColor, setShapeColor] = React.useState<ExplanationShapeColor>(
    DEFAULT_EXPLANATION_SHAPE_COLOR,
  );

  React.useEffect(() => {
    setArrowStart(null);
  }, [fen, tool]);

  const pickSquare = React.useCallback(
    (square: string) => {
      if (tool === "circle") {
        const idx = circles.findIndex((c) => c.square === square);
        if (idx >= 0) {
          onChange({
            circles: circles.filter((_, i) => i !== idx),
            arrows,
          });
        } else {
          onChange({
            circles: [...circles, { square, color: shapeColor }],
            arrows,
          });
        }
        return;
      }
      if (!arrowStart) {
        setArrowStart(square);
        return;
      }
      if (arrowStart === square) {
        setArrowStart(null);
        return;
      }
      onChange({
        circles,
        arrows: [
          ...arrows,
          {
            startSquare: arrowStart,
            endSquare: square,
            color: shapeColor,
          },
        ],
      });
      setArrowStart(null);
    },
    [tool, circles, arrows, onChange, arrowStart, shapeColor],
  );

  const removeCircle = (sq: string) => {
    onChange({ circles: circles.filter((c) => c.square !== sq), arrows });
  };

  const removeArrow = (index: number) => {
    onChange({ circles, arrows: arrows.filter((_, i) => i !== index) });
  };

  const clearAll = () => {
    setArrowStart(null);
    onChange({ circles: [], arrows: [] });
  };

  const hasShapes = circles.length > 0 || arrows.length > 0;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-800">Doska ustida ko‘rsatmalar</div>
        {hasShapes ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            onClick={clearAll}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Tozalash
          </button>
        ) : null}
      </div>

      <div className="mt-2">
        <div className="text-[11px] font-medium text-slate-600">Rang</div>
        <div className="mt-1.5 flex flex-wrap gap-2" role="group" aria-label="Ko‘rsatma rangi">
          {EXPLANATION_SHAPE_COLORS.map((hex) => (
            <button
              key={hex}
              type="button"
              title={hex}
              onClick={() => setShapeColor(hex)}
              className={[
                "h-7 w-7 rounded-full border-2 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/80",
                shapeColor === hex
                  ? "border-slate-900 shadow-md ring-2 ring-slate-400/60"
                  : "border-slate-300 hover:border-slate-500",
              ].join(" ")}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTool("circle")}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
            tool === "circle"
              ? "border-emerald-500 bg-emerald-50 text-emerald-900"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Circle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Doira
        </button>
        <button
          type="button"
          onClick={() => setTool("arrow")}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
            tool === "arrow"
              ? "border-emerald-500 bg-emerald-50 text-emerald-900"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          O‘q
        </button>
      </div>

      <p className="mt-2 text-xs leading-snug text-slate-600">
        {tool === "circle"
          ? "Katakka bosing — doira qo‘shiladi yoki olib tashlanadi."
          : arrowStart
            ? `Boshlang‘ich: ${arrowStart}. Tugatish uchun boshqa katakni bosing (bir xil katakkni bosib bekor qiling).`
            : "Birinchi katakkni bosing (o‘q boshlanishi), keyin ikkinchisini (tugashi)."}
      </p>

      <div className="mx-auto mt-3 max-w-[min(100%,320px)]">
        <BaseChessboard
          pickSquare={pickSquare}
          circles={circles}
          arrows={arrows}
          options={{
            position: fen,
            allowDragging: false,
            allowDrawingArrows: false,
            squareStyles: arrowStart
              ? { [arrowStart]: { background: "rgba(250, 204, 21, 0.38)" } }
              : undefined,
          }}
        />
      </div>

      {hasShapes ? (
        <div className="mt-3 space-y-2 border-t border-slate-200/80 pt-3">
          {circles.length > 0 ? (
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Doiralar</div>
              <div className="flex flex-wrap gap-1.5">
                {circles.map((c) => (
                  <button
                    key={c.square}
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-white px-2 py-0.5 font-mono text-xs text-emerald-900"
                    onClick={() => removeCircle(c.square)}
                    title="O‘chirish"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                      style={{ backgroundColor: c.color }}
                      aria-hidden
                    />
                    {c.square}
                    <span className="text-slate-400">×</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {arrows.length > 0 ? (
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">O‘qlar</div>
              <ul className="space-y-1">
                {arrows.map((a, i) => (
                  <li key={`${a.startSquare}-${a.endSquare}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 font-mono text-slate-700">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                        style={{
                          backgroundColor: a.color ?? baseChessboardArrowOptions.color,
                        }}
                        aria-hidden
                      />
                      <span className="truncate">
                        {a.startSquare} → {a.endSquare}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="rounded p-1 text-slate-500 hover:bg-slate-200/80 hover:text-red-600"
                      onClick={() => removeArrow(i)}
                      title="O‘chirish"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
