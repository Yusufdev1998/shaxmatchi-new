import * as React from "react";
import { createPortal } from "react-dom";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "./utils";

const LINE_CLAMP: Record<number, string> = {
  1: "truncate",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
};

export function ShaxTooltipProvider({
  children,
  delayDuration = 250,
}: {
  children: React.ReactNode;
  delayDuration?: number;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={0}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export type TruncatedTextProps = {
  text: string;
  /** Default 1 (single line with ellipsis). Use 2–3 for titles on narrow screens. */
  maxLines?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
};

/**
 * When text overflows the clamp:
 * - Hover/focus: Radix tooltip with full text.
 * - Tap “⋯”: opens a native dialog with full text (mobile-friendly; use e.stopPropagation on parents if needed).
 */
export function TruncatedText({ text, maxLines = 1, className }: TruncatedTextProps) {
  const spanRef = React.useRef<HTMLSpanElement>(null);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [overflow, setOverflow] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const clamp = LINE_CLAMP[maxLines] ?? "truncate";

  const measure = React.useCallback(() => {
    const el = spanRef.current;
    if (!el) return;
    if (maxLines === 1) {
      setOverflow(el.scrollWidth > el.clientWidth + 1);
    } else {
      setOverflow(el.scrollHeight > el.clientHeight + 1);
    }
  }, [maxLines]);

  React.useLayoutEffect(() => {
    measure();
  }, [text, measure]);

  React.useLayoutEffect(() => {
    const el = spanRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const openDialog = React.useCallback((e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dialogRef.current?.showModal();
  }, []);

  if (!text) return null;

  const inner = (
    <span
      ref={spanRef}
      className={cn(
        maxLines === 1 ? "block min-w-0" : "block min-w-0 break-words",
        clamp,
        overflow ? "cursor-help" : undefined,
        className,
      )}
    >
      {text}
    </span>
  );

  const withTooltip =
    overflow ? (
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{inner}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className="z-[300] max-h-[min(70vh,24rem)] max-w-[min(90vw,22rem)] overflow-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-lg"
            sideOffset={6}
            side="top"
            align="start"
          >
            <p className="whitespace-pre-wrap break-words">{text}</p>
            <TooltipPrimitive.Arrow className="fill-white" width={11} height={5} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    ) : (
      inner
    );

  const dialogEl = (
    <dialog
      ref={dialogRef}
      className="w-[min(92vw,24rem)] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl [&::backdrop]:bg-black/45"
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <p className="max-h-[min(60vh,20rem)] overflow-y-auto whitespace-pre-wrap break-words text-sm">{text}</p>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          onClick={() => dialogRef.current?.close()}
        >
          OK
        </button>
      </div>
    </dialog>
  );

  return (
    <>
      <span className="inline-flex min-w-0 max-w-full items-center gap-0.5 align-middle">
        <span className="min-w-0 flex-1">{withTooltip}</span>
        {overflow ? (
          <span
            role="button"
            tabIndex={0}
            className="shrink-0 cursor-pointer select-none rounded px-0.5 text-lg leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="To'liq matnni ko'rsatish"
            onClick={openDialog}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openDialog(e);
              }
            }}
          >
            ⋯
          </span>
        ) : null}
      </span>
      {mounted && overflow && typeof document !== "undefined" ? createPortal(dialogEl, document.body) : null}
    </>
  );
}
