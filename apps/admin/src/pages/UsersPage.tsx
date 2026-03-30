import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, TruncatedText } from "@shaxmatchi/ui";
import { Plus, Check, X, Pencil, Trash2, Link2, Copy } from "lucide-react";
import { AdminBreadcrumb } from "../components/AdminBreadcrumb";
import { InlineSpinner, LoadingCard } from "../components/loading";
import { adminUsersApi, type Student } from "../api/adminUsersApi";

export function UsersPage() {
  const [error, setError] = React.useState<string | null>(null);
  const [linkDialog, setLinkDialog] = React.useState<{
    login: string;
    deepLink: string;
    expiresAt: string;
  } | null>(null);
  const [linkingStudentId, setLinkingStudentId] = React.useState<string | null>(null);

  const [newLogin, setNewLogin] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [newTelegramId, setNewTelegramId] = React.useState("");

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingLogin, setEditingLogin] = React.useState("");
  const [editingPassword, setEditingPassword] = React.useState("");
  const [editingTelegramId, setEditingTelegramId] = React.useState("");

  const queryClient = useQueryClient();
  const studentsQuery = useQuery({
    queryKey: ["adminUsers", "students"],
    queryFn: adminUsersApi.listStudents,
  });
  const students: Student[] = studentsQuery.data ?? [];

  const createStudentMutation = useMutation({
    mutationFn: (input: { login: string; password: string; telegramId?: string }) => adminUsersApi.createStudent(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminUsers", "students"] });
    },
  });
  const updateStudentMutation = useMutation({
    mutationFn: (input: { studentId: string; login?: string; password?: string; telegramId?: string }) =>
      adminUsersApi.updateStudent(input.studentId, {
        login: input.login,
        password: input.password,
        telegramId: input.telegramId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminUsers", "students"] });
    },
  });
  const deleteStudentMutation = useMutation({
    mutationFn: (studentId: string) => adminUsersApi.deleteStudent(studentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminUsers", "students"] });
    },
  });
  const issueTelegramLinkMutation = useMutation({
    mutationFn: (studentId: string) => adminUsersApi.issueTelegramLink(studentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["adminUsers", "students"] });
    },
  });

  const busy =
    createStudentMutation.isPending || updateStudentMutation.isPending || deleteStudentMutation.isPending;
  const loading = studentsQuery.isLoading;

  React.useEffect(() => {
    if (studentsQuery.error) {
      setError(studentsQuery.error instanceof Error ? studentsQuery.error.message : "O'quvchilarni yuklab bo'lmadi");
    }
  }, [studentsQuery.error]);

  return (
    <div className="space-y-3">
      <AdminBreadcrumb items={[{ label: "Boshqaruv paneli", to: "/" }, { label: "O'quvchilar" }]} />
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">O'quvchilar</h1>
        <p className="mt-2 text-sm text-slate-600">
          O'quvchi hisoblarini yarating va boshqaring. Telegram uchun{" "}
          <span className="font-medium">Telegram havola</span> tugmasi orqali bir martalik havola yuboring — o'quvchi
          havolani ochganda akkaunt avtomatik bog'lanadi (backendda <span className="font-mono text-xs">TELEGRAM_BOT_USERNAME</span>{" "}
          va bot ishga tushirilgan bo'lishi kerak).
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">O'quvchi qo'shish</div>
              <div className="text-sm text-slate-600">O'qituvchi o'quvchilar uchun hisob yaratadi.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-slate-700">Login</span>
              <input
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400"
                value={newLogin}
                onChange={(e) => setNewLogin(e.target.value)}
                placeholder="masalan, student01"
                autoComplete="off"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-slate-700">Parol</span>
              <input
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="kamida 4 ta belgi"
                type="password"
                autoComplete="new-password"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-slate-700">Telegram ID (qo'lda, ixtiyoriy)</span>
              <input
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400"
                value={newTelegramId}
                onChange={(e) => setNewTelegramId(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="masalan, 123456789"
                autoComplete="off"
              />
            </label>
            <Button
              className="w-full sm:w-auto"
              disabled={busy || !newLogin.trim() || newPassword.length < 4}
              onClick={async () => {
                try {
                  setError(null);
                  await createStudentMutation.mutateAsync({
                    login: newLogin.trim(),
                    password: newPassword,
                    ...(newTelegramId.trim() ? { telegramId: newTelegramId.trim() } : {}),
                  });
                  setNewLogin("");
                  setNewPassword("");
                  setNewTelegramId("");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "O'quvchini yaratib bo'lmadi");
                }
              }}
            >
              {busy ? <InlineSpinner /> : <><Plus className="mr-1 h-3.5 w-3.5" /> Yaratish</>}
            </Button>
          </div>

          {error ? <div className="text-sm text-red-600">{error}</div> : null}
        </div>
      </div>

      {loading ? (
        <LoadingCard title="O'quvchilar yuklanmoqda..." />
      ) : (
        <div className="space-y-2">
          {students.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm sm:p-4">
              Hali o'quvchilar yo'q.
            </div>
          ) : (
            students.map((s) => {
              const isEditing = editingId === s.id;
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <TruncatedText text={s.login} className="text-sm font-semibold" />
                      <div className="text-xs text-slate-500">Telegram ID: {s.telegramId ?? "bog'lanmagan"}</div>
                      {s.createdAt ? (
                        <div className="text-xs text-slate-500">
                          Yaratilgan: {new Date(s.createdAt).toLocaleString()}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-row flex-wrap items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          <input
                            className="h-10 w-full min-w-44 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400 sm:w-56"
                            value={editingLogin}
                            onChange={(e) => setEditingLogin(e.target.value)}
                            placeholder="Login"
                            autoComplete="off"
                          />
                          <input
                            className="h-10 w-full min-w-44 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400 sm:w-56"
                            value={editingPassword}
                            onChange={(e) => setEditingPassword(e.target.value)}
                            placeholder="Yangi parol (ixtiyoriy)"
                            type="password"
                            autoComplete="new-password"
                          />
                          <input
                            className="h-10 w-full min-w-44 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-400 sm:w-56"
                            value={editingTelegramId}
                            onChange={(e) => setEditingTelegramId(e.target.value.replace(/[^\d]/g, ""))}
                            placeholder="Telegram ID (ixtiyoriy)"
                            autoComplete="off"
                          />
                          <div className="flex flex-row items-center gap-2">
                            <Button
                              disabled={busy || !editingLogin.trim()}
                              onClick={async () => {
                                try {
                                  setError(null);
                                  await updateStudentMutation.mutateAsync({
                                    studentId: s.id,
                                    login: editingLogin.trim(),
                                    ...(editingPassword ? { password: editingPassword } : {}),
                                    ...(editingTelegramId.trim() ? { telegramId: editingTelegramId.trim() } : {}),
                                  });
                                  setEditingId(null);
                                  setEditingPassword("");
                                  setEditingTelegramId("");
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : "O'quvchini yangilab bo'lmadi");
                                }
                              }}
                            >
                              {busy ? <InlineSpinner /> : <><Check className="mr-1 h-3.5 w-3.5" /> Saqlash</>}
                            </Button>
                            <Button
                              variant="secondary"
                              disabled={busy}
                              onClick={() => {
                                setEditingId(null);
                                setEditingPassword("");
                                setEditingTelegramId("");
                              }}
                            >
                              <X className="mr-1 h-3.5 w-3.5" /> Bekor qilish
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={async () => {
                              try {
                                setError(null);
                                setLinkingStudentId(s.id);
                                const r = await issueTelegramLinkMutation.mutateAsync(s.id);
                                setLinkDialog({
                                  login: s.login,
                                  deepLink: r.deepLink,
                                  expiresAt: r.expiresAt,
                                });
                              } catch (e) {
                                setError(e instanceof Error ? e.message : "Havola yaratib bo'lmadi");
                              } finally {
                                setLinkingStudentId(null);
                              }
                            }}
                            title="Telegramda ochiladigan bog'lash havolasi"
                          >
                            {linkingStudentId === s.id ? (
                              <InlineSpinner />
                            ) : (
                              <>
                                <Link2 className="mr-1 h-3.5 w-3.5" /> Telegram havola
                              </>
                            )}
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => {
                              setEditingId(s.id);
                              setEditingLogin(s.login);
                              setEditingPassword("");
                              setEditingTelegramId(s.telegramId ?? "");
                            }}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Tahrirlash
                          </Button>
                          <Button
                            variant="danger"
                            disabled={busy}
                            onClick={async () => {
                              const ok = confirm(`O'quvchini o'chirish: "${s.login}"?`);
                              if (!ok) return;
                              try {
                                setError(null);
                                await deleteStudentMutation.mutateAsync(s.id);
                              } catch (e) {
                                setError(e instanceof Error ? e.message : "O'quvchini o'chirib bo'lmadi");
                              }
                            }}
                          >
                            {busy ? <InlineSpinner /> : <><Trash2 className="mr-1 h-3.5 w-3.5" /> O'chirish</>}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {linkDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="text-sm font-semibold">Telegram bog'lash havolasi</div>
            <div className="mt-1 text-xs text-slate-600">
              O'quvchi: <span className="font-medium">{linkDialog.login}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Havolani o'quvchiga yuboring. U Telegramda ochganda bot akkauntni bog'laydi; keyin Mini App ishlaydi.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                readOnly
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800"
                value={linkDialog.deepLink}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(linkDialog.deepLink);
                }}
                title="Nusxa olish"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 text-xs text-slate-500">
              Muddati: {new Date(linkDialog.expiresAt).toLocaleString()}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setLinkDialog(null)}>
                Yopish
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

