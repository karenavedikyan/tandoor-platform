import { useMemo, useState } from "react";
import { Link } from "wouter";
import { LayoutGrid, List, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getAllMatrixTasks,
  MATRIX_TASK_PRIORITY_LABEL,
  MATRIX_TASK_ROLE_LABEL,
  MATRIX_TASK_STATUS_LABEL,
  MATRIX_TASK_TYPE_LABEL,
  summarizeMatrixTasks,
  type MatrixTaskAssigneeRole,
  type MatrixTaskPriority,
  type MatrixTaskStatus,
  type MatrixTaskWithContext,
} from "@/lib/trade-point-task-data";

type TasksFilterId =
  | "all"
  | "new"
  | "in_progress"
  | "overdue"
  | "high"
  | "manager"
  | "regional_manager";

type ViewMode = "cards" | "list";

const FILTERS: { id: TasksFilterId; label: string; testId: string }[] = [
  { id: "all", label: "Все", testId: "filter-tasks-all" },
  { id: "new", label: "Новые", testId: "filter-tasks-new" },
  { id: "in_progress", label: "В работе", testId: "filter-tasks-in-progress" },
  { id: "overdue", label: "Просроченные", testId: "filter-tasks-overdue" },
  { id: "high", label: "Высокий приоритет", testId: "filter-tasks-high" },
  { id: "manager", label: "Менеджер", testId: "filter-tasks-manager" },
  { id: "regional_manager", label: "Регионал", testId: "filter-tasks-regional-manager" },
];

function statusTone(s: MatrixTaskStatus) {
  if (s === "new") return "border-primary/40 bg-primary/10 text-primary";
  if (s === "in_progress") return "border-amber-200 bg-amber-50 text-amber-950";
  if (s === "overdue") return "border-red-200 bg-red-50 text-red-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function priorityTone(p: MatrixTaskPriority) {
  if (p === "high") return "border-red-200 bg-red-50 text-red-900";
  if (p === "medium") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted text-muted-foreground";
}

function zoneTone(z: "A" | "B" | "C") {
  if (z === "A") return "border-primary/40 bg-primary/10 text-primary";
  if (z === "B") return "border-border bg-muted text-foreground";
  return "border-border bg-muted/60 text-muted-foreground";
}

function applyFilter(tasks: MatrixTaskWithContext[], filter: TasksFilterId) {
  if (filter === "all") return tasks;
  if (filter === "high") return tasks.filter((t) => t.priority === "high");
  if (filter === "manager" || filter === "regional_manager") {
    const role: MatrixTaskAssigneeRole = filter;
    return tasks.filter((t) => t.assigneeRole === role);
  }
  return tasks.filter((t) => t.status === filter);
}

function applySearch(tasks: MatrixTaskWithContext[], q: string) {
  const norm = q.trim().toLowerCase();
  if (!norm) return tasks;
  return tasks.filter((t) => {
    return (
      t.dealerName.toLowerCase().includes(norm) ||
      t.tradePointName.toLowerCase().includes(norm) ||
      t.productName.toLowerCase().includes(norm) ||
      t.productArticle.toLowerCase().includes(norm) ||
      t.title.toLowerCase().includes(norm)
    );
  });
}

function statusOrder(s: MatrixTaskStatus) {
  if (s === "overdue") return 0;
  if (s === "new") return 1;
  if (s === "in_progress") return 2;
  return 3;
}

function priorityOrder(p: MatrixTaskPriority) {
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}

function sortTasks(tasks: MatrixTaskWithContext[]) {
  return [...tasks].sort((a, b) => {
    const so = statusOrder(a.status) - statusOrder(b.status);
    if (so !== 0) return so;
    const po = priorityOrder(a.priority) - priorityOrder(b.priority);
    if (po !== 0) return po;
    return a.taskId.localeCompare(b.taskId);
  });
}

function TasksKpis({ tasks }: { tasks: MatrixTaskWithContext[] }) {
  const summary = useMemo(() => summarizeMatrixTasks(tasks), [tasks]);
  const tiles = [
    { label: "Всего", value: summary.total, tone: "border-border bg-muted/40 text-foreground" },
    { label: "Новые", value: summary.newCount, tone: "border-primary/40 bg-primary/10 text-primary" },
    {
      label: "В работе",
      value: summary.inProgressCount,
      tone: "border-amber-200 bg-amber-50 text-amber-950",
    },
    {
      label: "Просрочено",
      value: summary.overdueCount,
      tone: "border-red-200 bg-red-50 text-red-900",
    },
    {
      label: "Высокий приоритет",
      value: summary.highPriorityCount,
      tone: "border-border bg-card text-foreground",
    },
  ];
  return (
    <Card
      className="rounded-2xl border border-border/80 bg-card shadow-md"
      data-testid="section-tasks-kpis"
    >
      <CardContent className="space-y-3 pt-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {tiles.map((t) => (
            <div key={t.label} className={cn("rounded-xl border px-3 py-2.5", t.tone)}>
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                {t.label}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{t.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TaskCard({ task }: { task: MatrixTaskWithContext }) {
  return (
    <Card
      className="rounded-2xl border border-border/80 bg-card shadow-md"
      data-testid={`card-task-${task.taskId}`}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug text-foreground">{task.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {task.dealerName} · {task.tradePointName}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <Badge variant="outline" className={cn("font-medium", statusTone(task.status))}>
              {MATRIX_TASK_STATUS_LABEL[task.status]}
            </Badge>
            <Badge variant="outline" className={cn("font-medium", priorityTone(task.priority))}>
              {MATRIX_TASK_PRIORITY_LABEL[task.priority]}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="border-border bg-muted/60 font-medium">
            {MATRIX_TASK_TYPE_LABEL[task.type]}
          </Badge>
          <Badge variant="outline" className={cn("font-medium", zoneTone(task.zone))}>
            Зона {task.zone}
          </Badge>
          <Badge variant="outline" className="border-border bg-card font-medium">
            {task.portal}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Модель
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{task.productName}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Артикул
            </p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{task.productArticle}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Срок
            </p>
            <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
              {task.dueDate}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ответственный
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {MATRIX_TASK_ROLE_LABEL[task.assigneeRole]}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Образцы
            </p>
            <p className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
              {task.actualSamples} / {task.targetSamples}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            asChild
            variant="outline"
            className="min-h-10 w-full border-border bg-card sm:w-auto"
            data-testid={`button-open-task-dealer-${task.taskId}`}
          >
            <Link href={`/dealers/${task.dealerId}`}>Открыть дилера</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="min-h-10 w-full border-border bg-card sm:w-auto"
            data-testid={`button-open-task-trade-point-${task.taskId}`}
          >
            <Link href={`/dealers/${task.dealerId}/trade-points/${task.tradePointId}`}>
              Открыть точку
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="min-h-10 w-full border-border bg-card sm:w-auto"
            data-testid={`button-open-task-product-${task.taskId}`}
          >
            <Link href={`/catalog/${task.productId}`}>Открыть модель</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskListRow({ task }: { task: MatrixTaskWithContext }) {
  return (
    <Card
      className="rounded-2xl border border-border/80 bg-card shadow-sm"
      data-testid={`card-task-${task.taskId}`}
    >
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold leading-snug text-foreground">{task.title}</p>
            <Badge variant="outline" className={cn("font-medium", statusTone(task.status))}>
              {MATRIX_TASK_STATUS_LABEL[task.status]}
            </Badge>
            <Badge variant="outline" className={cn("font-medium", priorityTone(task.priority))}>
              {MATRIX_TASK_PRIORITY_LABEL[task.priority]}
            </Badge>
            <Badge variant="outline" className={cn("font-medium", zoneTone(task.zone))}>
              Зона {task.zone}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {task.dealerName} · {task.tradePointName} · {task.productName} ·{" "}
            <span className="font-mono">{task.productArticle}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {MATRIX_TASK_TYPE_LABEL[task.type]} · {task.portal} · Срок{" "}
            <span className="tabular-nums">{task.dueDate}</span> ·{" "}
            {MATRIX_TASK_ROLE_LABEL[task.assigneeRole]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-9 border-border bg-card"
            data-testid={`button-open-task-dealer-${task.taskId}`}
          >
            <Link href={`/dealers/${task.dealerId}`}>Дилер</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-9 border-border bg-card"
            data-testid={`button-open-task-trade-point-${task.taskId}`}
          >
            <Link href={`/dealers/${task.dealerId}/trade-points/${task.tradePointId}`}>Точка</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-9 border-border bg-card"
            data-testid={`button-open-task-product-${task.taskId}`}
          >
            <Link href={`/catalog/${task.productId}`}>Модель</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TasksPage() {
  const allTasks = useMemo(() => sortTasks(getAllMatrixTasks()), []);
  const [filter, setFilter] = useState<TasksFilterId>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("cards");

  const filtered = useMemo(
    () => applySearch(applyFilter(allTasks, filter), query),
    [allTasks, filter, query],
  );

  return (
    <div className="space-y-4 sm:space-y-6" data-testid="page-tasks">
      <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8">
        <div
          className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary"
          aria-hidden
        />
        <div className="relative pl-3 sm:pl-4">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Задачи
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Общий рабочий список по всем дилерам и торговым точкам — на основе матриц товаров.
          </p>
        </div>
      </header>

      <TasksKpis tasks={allTasks} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            inputMode="search"
            placeholder="Поиск по дилеру, точке, модели или артикулу"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11 pl-9"
            data-testid="input-tasks-search"
            aria-label="Поиск задач"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant={view === "cards" ? "default" : "outline"}
            className={cn(
              "min-h-10",
              view === "cards" ? "font-semibold" : "border-border bg-card",
            )}
            data-testid="button-tasks-view-cards"
            onClick={() => setView("cards")}
            aria-pressed={view === "cards"}
          >
            <LayoutGrid className="mr-1.5 h-4 w-4" aria-hidden />
            Карточки
          </Button>
          <Button
            type="button"
            variant={view === "list" ? "default" : "outline"}
            className={cn(
              "min-h-10",
              view === "list" ? "font-semibold" : "border-border bg-card",
            )}
            data-testid="button-tasks-view-list"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
          >
            <List className="mr-1.5 h-4 w-4" aria-hidden />
            Список
          </Button>
        </div>
      </div>

      <div
        className="-mx-4 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
        role="tablist"
        aria-label="Фильтры задач"
      >
        <div className="flex gap-2 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              data-testid={f.testId}
              className={cn(
                "min-h-10 shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                filter === f.id
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground" data-testid="text-tasks-count">
        Показано задач:{" "}
        <span className="font-semibold tabular-nums text-foreground">{filtered.length}</span> из{" "}
        <span className="tabular-nums">{allTasks.length}</span>
      </p>

      {filtered.length === 0 ? (
        <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
          <CardContent className="pt-5 text-sm text-muted-foreground">
            По выбранным условиям задач нет. Измените фильтр или поисковый запрос.
          </CardContent>
        </Card>
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((t) => (
            <TaskCard key={t.taskId} task={t} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <TaskListRow key={t.taskId} task={t} />
          ))}
        </div>
      )}
    </div>
  );
}
