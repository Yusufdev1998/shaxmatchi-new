/** Shared Tailwind classes for admin Debuts CRUD pages — compact density + consistent look */
export const debutsUi = {
  page: "space-y-2",
  title: "text-lg font-semibold tracking-tight text-slate-900",
  desc: "mt-0.5 text-xs text-slate-500",
  contextLine: "mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-600",
  headerRow: "flex flex-wrap items-start justify-between gap-2",
  card: "overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
  input:
    "h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-300",
  error: "rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700",
  empty: "px-3 py-6 text-center text-xs text-slate-500",
  addRow: "flex gap-2 border-b border-slate-100 bg-slate-50/70 p-2 sm:p-2.5",
  listRows: "divide-y divide-slate-100",
  row: "flex items-center justify-between gap-2 px-2.5 py-2 sm:px-3",
  rowHover: "transition-colors hover:bg-slate-50/90",
  renameRow: "flex flex-wrap items-end gap-2 border-b border-slate-100 bg-amber-50/50 p-2 sm:p-2.5",
  linkBtn:
    "inline-flex h-8 w-8 items-center justify-center rounded text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  accentLink:
    "inline-flex h-8 w-8 items-center justify-center rounded text-xs font-medium text-emerald-700 hover:bg-emerald-50 hover:text-emerald-900",
  indigoLink:
    "inline-flex h-8 w-8 items-center justify-center rounded text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800",
  dangerBtn:
    "inline-flex h-8 w-8 items-center justify-center rounded text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-800",
  loadingBox: "flex items-center justify-center gap-2 px-3 py-8 text-xs text-slate-500",
  textarea:
    "min-h-[5.5rem] w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-xs outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-300",
  formCardPad: "space-y-2 p-2.5 sm:p-3",
};
