import * as React from "react";
import { Button } from "@shaxmatchi/ui";
import { API_URL, getAuthUser } from "../auth/auth";

export type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Confirm button: use danger for destructive actions */
  variant?: "default" | "danger";
  busy?: boolean;
  /** When true, show a password field and verify before confirming */
  requirePassword?: boolean;
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
  requirePassword,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [password, setPassword] = React.useState("");
  const [passwordError, setPasswordError] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setPassword("");
    setPasswordError(null);
    setVerifying(false);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const handleConfirm = async () => {
    if (requirePassword) {
      if (!password.trim()) {
        setPasswordError("Parolni kiriting");
        return;
      }
      setPasswordError(null);
      setVerifying(true);
      try {
        const user = getAuthUser();
        const res = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login: user?.login, password }),
        });
        if (!res.ok) {
          setPasswordError("Parol noto'g'ri");
          return;
        }
      } catch {
        setPasswordError("Tekshirib bo'lmadi");
        return;
      } finally {
        setVerifying(false);
      }
    }
    onConfirm();
  };

  const isBusy = busy || verifying;

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
        {requirePassword ? (
          <div className="mt-3">
            <input
              type="password"
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Parolni kiriting"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
              disabled={isBusy}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleConfirm(); } }}
              autoFocus
            />
            {passwordError ? (
              <p className="mt-1 text-xs text-red-600">{passwordError}</p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={isBusy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={variant === "danger" ? "danger" : "default"}
            disabled={isBusy || (requirePassword && !password.trim())}
            onClick={() => void handleConfirm()}
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
