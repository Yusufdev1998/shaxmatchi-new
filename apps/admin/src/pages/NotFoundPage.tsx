import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Home } from "lucide-react";
import { Button } from "@shaxmatchi/ui";

export function NotFoundPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : "Sahifa topilmadi";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-md px-4 py-8 sm:max-w-xl sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="text-sm font-semibold">Topilmadi</div>
          <div className="mt-1 text-sm text-slate-600">{message}</div>
          <div className="mt-4">
            <Button asChild>
              <Link to="/"><Home className="mr-1.5 h-4 w-4" /> Bosh sahifaga</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

