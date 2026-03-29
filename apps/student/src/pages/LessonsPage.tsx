import { Button } from "@shaxmatchi/ui";
import { Play } from "lucide-react";

export function LessonsPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Darslar</h1>
        <p className="mt-2 text-sm text-slate-600">O'quvchi navigatsiyasi uchun namuna sahifa.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Hali darslar yo'q</div>
            <div className="text-sm text-slate-600">Keyinroq backendga ulang.</div>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => alert("Darsni boshlash (TODO)")}>
            <Play className="mr-1.5 h-4 w-4" /> Darsni boshlash
          </Button>
        </div>
      </div>
    </div>
  );
}

