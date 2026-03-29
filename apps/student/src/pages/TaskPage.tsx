import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@shaxmatchi/ui";
import { Link, useNavigate, useParams } from "react-router-dom";

type Puzzle = {
  id: string;
  title: string;
};

type Task = {
  id: string;
  moduleId: string;
  moduleTitle: string;
  courseTitle: string;
  title: string;
  puzzles: Puzzle[];
};

const TASKS: Record<string, Task> = {
  "four-knights": {
    id: "four-knights",
    moduleId: "41",
    moduleTitle: "3-2 razryad debyutlari",
    courseTitle: "1. e2-e4 oqlar bilan",
    title: "To'rt otliq debyut",
    puzzles: [
      {
        id: "four-knights-scotch-accepted-5d6",
        title: "To'rt otliq debyut. Qabul qilingan shotland varianti 5....d6",
      },
      {
        id: "four-knights-scotch-accepted-6bg5",
        title: "To'rt otliq debyut. Qabul qilingan shotland varianti 6.Bg5",
      },
    ],
  },
  "italian": {
    id: "italian",
    moduleId: "41",
    moduleTitle: "3-2 razryad debyutlari",
    courseTitle: "1. e2-e4 oqlar bilan",
    title: "Italyan partiyasi",
    puzzles: [
      { id: "italian-two-knights", title: "Italyan partiyasi. Himoyada ikki ot" },
      { id: "italian-giuoco-piano", title: "Italyan partiyasi. Jyuoko piano" },
    ],
  },
  "london": {
    id: "london",
    moduleId: "41",
    moduleTitle: "3-2 razryad debyutlari",
    courseTitle: "2. d2-d4 oqlar bilan",
    title: "London tizimi",
    puzzles: [{ id: "london-basic-setup", title: "London tizimi. Asosiy joylashish" }],
  },
};

export function TaskPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const task = id ? TASKS[id] : undefined;

  if (!task) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="text-sm font-semibold">Vazifa topilmadi</div>
        <div className="mt-1 text-sm text-slate-600">
          Mavjud demo vazifalar: {Object.keys(TASKS).join(", ")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/debut">Debyutlar</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/course/${task.moduleId}`}>{task.moduleTitle}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{task.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{task.title}</h1>
        <div className="mt-1 text-sm text-slate-600">
          Kurs: <span className="font-medium text-slate-900">{task.courseTitle}</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="text-sm font-semibold">Pazllar</div>
        <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
          {task.puzzles.map((p) => (
            <button
              key={p.id}
              type="button"
              className="w-full bg-white px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
              onClick={() => navigate(`/puzzle/${p.id}`)}
            >
              {p.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

