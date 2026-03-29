import * as React from "react";

export function InlineSpinner({ className }: { className?: string }) {
  return (
    <span
      className={[
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Yuklanmoqda"
      role="status"
    />
  );
}

export function LoadingCard({
  title = "Yuklanmoqda…",
  lines = 3,
  compact,
}: {
  title?: string;
  lines?: number;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-lg border border-slate-200 bg-white shadow-sm",
        compact ? "p-2.5 sm:p-3" : "p-3 sm:p-4",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <InlineSpinner />
        <div className={compact ? "text-xs font-medium text-slate-700" : "text-sm font-medium text-slate-800"}>
          {title}
        </div>
      </div>
      <div className={compact ? "mt-2 space-y-1.5" : "mt-3 space-y-2"}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className={compact ? "h-2.5 w-full animate-pulse rounded bg-slate-100" : "h-3 w-full animate-pulse rounded bg-slate-100"}
          />
        ))}
      </div>
    </div>
  );
}

