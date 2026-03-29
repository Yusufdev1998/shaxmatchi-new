import * as React from "react";
import { Button } from "@shaxmatchi/ui";
import { Link } from "react-router-dom";
import { Swords } from "lucide-react";

async function getHealth(): Promise<{ ok: boolean; service: string } | null> {
  try {
    const res = await fetch("http://localhost:3000/health");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function HomePage() {
  const [health, setHealth] = React.useState<string>("loading...");

  React.useEffect(() => {
    void (async () => {
      const data = await getHealth();
      setHealth(data ? `ok (${data.service})` : "backend not reachable");
    })();
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Bosh sahifa</h1>
        <p className="mt-2 text-sm text-slate-600">
          Backend holati:{" "}
          <span className="rounded-md bg-white px-2 py-1 font-mono text-xs text-slate-800 ring-1 ring-slate-200">
            {health}
          </span>
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <h2 className="text-base font-semibold">Salom Dunyo</h2>
        <p className="mt-1 text-sm text-slate-600">
          Umumiy shadcn uslubidagi <code className="font-mono text-xs">@shaxmatchi/ui</code> tugma.
        </p>

        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
          <Button asChild className="w-full sm:w-auto" variant="secondary">
            <Link to="/debut"><Swords className="mr-1.5 h-4 w-4" /> Debyutlar (tayinlangan)</Link>
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => alert("O'quvchidan salom!")}>
            Umumiy UI tugma
          </Button>
          <Button className="w-full sm:w-auto" variant="secondary" onClick={() => alert("Ikkilamchi tugma")}>
            Ikkilamchi
          </Button>
        </div>
      </div>
    </div>
  );
}

