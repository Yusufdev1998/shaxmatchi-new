import * as React from "react";
import { Button } from "@shaxmatchi/ui";

export type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Confirm button: use danger for destructive actions */
  variant?: "default" | "danger";
  busy?: boolean;
};

type ConfirmDialogProps = ConfirmDialogOptions & {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "OK",
  cancelLabel = "Bekor qilish",
  variant = "default",
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
      >
        <div id="confirm-dialog-title" className="text-sm font-semibold text-slate-900">
          {title}
        </div>
        {description ? (
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{description}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={variant === "danger" ? "danger" : "default"}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function useConfirmDialog() {
  const [state, setState] = React.useState<{
    options: ConfirmDialogOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = React.useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const handleCancel = React.useCallback(() => {
    setState((s) => {
      if (s) s.resolve(false);
      return null;
    });
  }, []);

  const handleConfirm = React.useCallback(() => {
    setState((s) => {
      if (s) s.resolve(true);
      return null;
    });
  }, []);

  const dialog = state ? (
    <ConfirmDialog open {...state.options} onCancel={handleCancel} onConfirm={handleConfirm} />
  ) : null;

  return { confirm, dialog };
}
