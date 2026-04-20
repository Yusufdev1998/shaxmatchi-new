import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Palette, Volume2 } from "lucide-react";
import { Button } from "@shaxmatchi/ui";
import { AdminBreadcrumb } from "../components/AdminBreadcrumb";
import { InlineSpinner } from "../components/loading";
import { adminAuthApi } from "../api/adminAuthApi";
import { adminSettingsApi, type AppSettings } from "../api/adminSettingsApi";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["appSettings"],
    queryFn: adminSettingsApi.get,
  });
  const [audioAutoplay, setAudioAutoplay] = React.useState<boolean>(true);
  const [audioDelaySeconds, setAudioDelaySeconds] = React.useState<number>(5);
  const [audioError, setAudioError] = React.useState<string | null>(null);
  const [audioSuccess, setAudioSuccess] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!settingsQuery.data) return;
    setAudioAutoplay(settingsQuery.data.audioAutoplay);
    setAudioDelaySeconds(settingsQuery.data.audioDelaySeconds);
  }, [settingsQuery.data]);

  const updateSettingsMutation = useMutation({
    mutationFn: (input: { audioAutoplay: boolean; audioDelaySeconds: number }) =>
      adminSettingsApi.update(input),
    onSuccess: (data: AppSettings) => {
      queryClient.setQueryData(["appSettings"], data);
      setAudioError(null);
      setAudioSuccess("Audio sozlamalari saqlandi.");
    },
    onError: (e: unknown) => {
      setAudioSuccess(null);
      setAudioError(e instanceof Error ? e.message : "Sozlamalarni saqlab bo'lmadi");
    },
  });

  function onSubmitAudioSettings(e: React.FormEvent) {
    e.preventDefault();
    setAudioError(null);
    setAudioSuccess(null);
    updateSettingsMutation.mutate({ audioAutoplay, audioDelaySeconds });
  }

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
        <div className="mb-3">
          <div className="text-sm font-semibold">Audio avto-ijro</div>
          <div className="text-sm text-slate-600">
            O'quvchida audio tushuntirish qanday ijro etilishini sozlang.
          </div>
        </div>

        {settingsQuery.isLoading ? (
          <div className="inline-flex items-center gap-2 text-sm text-slate-500">
            <InlineSpinner />
            Yuklanmoqda…
          </div>
        ) : (
          <form className="grid max-w-md gap-3" onSubmit={onSubmitAudioSettings}>
            <label className="flex items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={audioAutoplay}
                onChange={(e) => setAudioAutoplay(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Audio avtomatik ijro etilsin</span>
            </label>
            <label
              className={`grid gap-1 transition-opacity ${
                audioAutoplay ? "" : "pointer-events-none opacity-50"
              }`}
            >
              <span className="text-xs font-medium text-slate-700">Kechikish (sekund)</span>
              <input
                className={inputClass}
                type="number"
                min={0}
                max={60}
                step={1}
                value={audioDelaySeconds}
                disabled={!audioAutoplay}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  if (Number.isNaN(raw)) return;
                  setAudioDelaySeconds(Math.max(0, Math.min(60, Math.round(raw))));
                }}
              />
            </label>

            {audioError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{audioError}</div>
            )}
            {audioSuccess && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                {audioSuccess}
              </div>
            )}

            <div>
              <Button type="submit" className="w-full sm:w-auto" disabled={updateSettingsMutation.isPending}>
                {updateSettingsMutation.isPending ? (
                  <span className="inline-flex items-center gap-2">
                    <InlineSpinner />
                    Saqlanmoqda…
                  </span>
                ) : (
                  <><Volume2 className="mr-1.5 h-4 w-4" /> Saqlash</>
                )}
              </Button>
            </div>
          </form>
        )}
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
