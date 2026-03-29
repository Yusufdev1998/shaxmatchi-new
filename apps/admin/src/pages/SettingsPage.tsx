import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Lock, Palette } from "lucide-react";
import { Button } from "@shaxmatchi/ui";
import { AdminBreadcrumb } from "../components/AdminBreadcrumb";
import { InlineSpinner } from "../components/loading";
import { adminAuthApi } from "../api/adminAuthApi";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400";

export function SettingsPage() {
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const changePasswordMutation = useMutation({
    mutationFn: (input: { oldPassword: string; newPassword: string }) => adminAuthApi.changePassword(input),
    onSuccess: () => {
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setLocalError(null);
      setSuccess("Parol yangilandi.");
    },
    onError: (e: unknown) => {
      setSuccess(null);
      setLocalError(e instanceof Error ? e.message : "Parolni yangilab bo'lmadi");
    },
  });

  function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    changePasswordMutation.reset();
    setLocalError(null);
    setSuccess(null);
    if (newPassword.length < 4) {
      setLocalError("Yangi parol kamida 4 ta belgidan iborat bo'lishi kerak.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setLocalError("Yangi parol va tasdiqlash mos kelmaydi.");
      return;
    }
    changePasswordMutation.mutate({ oldPassword, newPassword });
  }

  return (
    <div className="space-y-3">
      <AdminBreadcrumb items={[{ label: "Boshqaruv paneli", to: "/" }, { label: "Sozlamalar" }]} />
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Sozlamalar</h1>
        <p className="mt-2 text-sm text-slate-600">Hisob va sozlamalar.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3">
          <div className="text-sm font-semibold">Parolni o'zgartirish</div>
          <div className="text-sm text-slate-600">Joriy parolingizni kiriting, keyin yangisini tanlang.</div>
        </div>

        <form className="grid max-w-md gap-3" onSubmit={onSubmitPassword} autoComplete="off">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">Joriy parol</span>
            <input
              className={inputClass}
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">Yangi parol</span>
            <input
              className={inputClass}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={4}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">Yangi parolni tasdiqlang</span>
            <input
              className={inputClass}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={4}
            />
          </label>

          {localError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{localError}</div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {success}
            </div>
          )}

          <div>
            <Button type="submit" className="w-full sm:w-auto" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <InlineSpinner />
                  Yangilanmoqda…
                </span>
              ) : (
                <><Lock className="mr-1.5 h-4 w-4" /> Parolni yangilash</>
              )}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Mavzu</div>
            <div className="text-sm text-slate-600">Qorong'i rejim keyinroq qo'shiladi.</div>
          </div>
          <Button className="w-full sm:w-auto" variant="secondary" onClick={() => alert("Mavzu o'zgartirish (TODO)")}>
            <Palette className="mr-1.5 h-4 w-4" /> Mavzuni o'zgartirish
          </Button>
        </div>
      </div>
    </div>
  );
}
