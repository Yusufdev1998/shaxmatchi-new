import { Button } from "@shaxmatchi/ui";
import { Link } from "react-router-dom";
import { Swords } from "lucide-react";

export function HomePage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Bosh sahifa</h1>
        <p className="mt-2 text-sm text-slate-600">Tayinlangan variantlarni mashq qiling va natijani kuzating.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <h2 className="text-base font-semibold">Debyutlar</h2>
        <p className="mt-1 text-sm text-slate-600">
          O'qituvchi sizga tayinlagan variantlar ro'yxatini oching.
        </p>
        <div className="mt-4">
          <Button asChild className="w-full sm:w-auto" variant="secondary">
            <Link to="/debut"><Swords className="mr-1.5 h-4 w-4" /> Debyutlar (tayinlangan)</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

