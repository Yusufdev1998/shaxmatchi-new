import { useNavigate } from "react-router-dom";
import { Swords, Users, Settings, BarChart3 } from "lucide-react";
import { Button } from "@shaxmatchi/ui";
import { AdminBreadcrumb } from "../components/AdminBreadcrumb";

export function DashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-2">
      <AdminBreadcrumb compact items={[{ label: "Boshqaruv paneli" }]} />
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Boshqaruv paneli</h1>
        <p className="mt-0.5 text-xs text-slate-500">Kontent, o'quvchilar va sozlamalar.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="w-full sm:w-auto" onClick={() => navigate("/debuts")}>
          <Swords className="mr-1 h-4 w-4" /> Debyutlar
        </Button>
        <Button size="sm" className="w-full sm:w-auto" variant="secondary" onClick={() => navigate("/users")}>
          <Users className="mr-1 h-4 w-4" /> O'quvchilar
        </Button>
        <Button size="sm" className="w-full sm:w-auto" variant="secondary" onClick={() => navigate("/stats")}>
          <BarChart3 className="mr-1 h-4 w-4" /> Statistika
        </Button>
        <Button size="sm" className="w-full sm:w-auto" variant="secondary" onClick={() => navigate("/settings")}>
          <Settings className="mr-1 h-4 w-4" /> Sozlamalar
        </Button>
      </div>
    </div>
  );
}
