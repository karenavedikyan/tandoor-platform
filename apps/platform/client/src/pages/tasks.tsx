import { useMemo, useState } from "react";
import { Link } from "wouter";
import { LayoutGrid, List, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
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
import { getTrainingArticleIdForTask } from "@/lib/training-data";

type TasksFilterId =
  | "all"
  | "new"
  | "in_progress"
  | "overdue"
  | "high"
  | "manager"
  | "regional_manager";

type ViewMode = "cards" | "list";

type RoleViewId = "all" | "manager" | "regional_manager" | "leadership";

const ROLE_VIEWS: {
  id: RoleViewId;
  label: string;
  testId: string;
  description: string;
}[] = [
  {
    id: "all",
    label: "Все",
    testId: "filter-tasks-role-all",
    description:
      "Все задачи: общий рабочий список по дилерам, торговым точкам и моделям.",
  },
  {
    id: "manager",
    label: "Менеджер",
    testId: "filter-tasks-role-manager",
    description: "Менеджер: задачи по продажам и моделям.",
  },
  {
    id: "regional_manager",
    label: "Регионал",
    testId: "filter-tasks-role-regional-manager",
    description: "Регионал: задачи по точкам, витринам и проверкам.",
  },
  {
    id: "leadership",
    label: "Руководитель",
    testId: "filter-tasks-role-leadership",
    description: "Руководитель: просрочки и высокий приоритет по команде.",
  },
];

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

function applyRole(tasks: MatrixTaskWithContext[], role: RoleViewId) {
  if (role === "all" || role === "leadership") return tasks;
  const target: MatrixTaskAssigneeRole = role;
  return tasks.filter((t) => t.assigneeRole === target);
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

function sortLeadership(tasks: MatrixTaskWithContext[]) {
  return [...tasks].sort((a, b) => {
    const aOver = a.status === "overdue" ? 0 : 1;
    const bOver = b.status === "overdue" ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    const po = priorityOrder(a.priority) - priorityOrder(b.priority);
    if (po !== 0) return po;
    const so = statusOrder(a.status) - statusOrder(b.status);
    if (so !== 0) return so;
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
  const trainingArticleId = getTrainingArticleIdForTask({
    insightDomain: task.insightDomain,
    productId: task.productId,
  });
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
          {task.source === "product_training" ? (
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/5 font-medium text-foreground"
              data-testid={`badge-task-source-training-${task.taskId}`}
            >
              Обучение
            </Badge>
          ) : null}
          <Badge variant="outline" className={cn("font-medium", zoneTone(task.zone))}>
            Зона {task.zone}
          </Badge>
          <Badge variant="outline" className="border-border bg-card font-medium">
            {task.portal}
          </Badge>
          {task.insightLabel ? (
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/5 font-medium text-foreground"
              data-testid={`badge-task-source-${task.taskId}`}
            >
              {task.insightLabel}
            </Badge>
          ) : null}
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
          {trainingArticleId ? (
            <Button
              asChild
              variant="outline"
              className="min-h-10 w-full border-border bg-card sm:w-auto"
              data-testid={`button-task-open-training-material-${task.taskId}`}
            >
              <Link href={`/training/${trainingArticleId}`}>Материал по теме</Link>
            </Button>
          ) : null}
          {task.source === "product_training" && task.trainingProgramId ? (
            <Button
              asChild
              variant="default"
              className="min-h-10 w-full font-semibold sm:w-auto"
              data-testid={`button-task-open-training-${task.taskId}`}
            >
              <Link href={`/training/programs/${task.trainingProgramId}`}>К программе обучения</Link>
            </Button>
          ) : null}
          <Button
            asChild
            variant="outline"
            className="min-h-10 w-full border-border bg-card sm:w-auto"
            data-testid={`button-task-open-related-dealer-${task.taskId}`}
          >
            <Link href={`/dealers/${task.dealerId}`}>Открыть дилера</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="min-h-10 w-full border-border bg-card sm:w-auto"
            data-testid={`button-task-open-related-trade-point-${task.taskId}`}
          >
            <Link href={`/dealers/${task.dealerId}/trade-points/${task.tradePointId}`}>
              Открыть точку
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="min-h-10 w-full border-border bg-card sm:w-auto"
            data-testid={`button-task-open-related-product-${task.taskId}`}
          >
            <Link href={`/catalog/${task.productId}`}>Открыть модель</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskListRow({ task }: { task: MatrixTaskWithContext }) {
  const trainingArticleId = getTrainingArticleIdForTask({
    insightDomain: task.insightDomain,
    productId: task.productId,
  });
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
            {task.source === "product_training" ? (
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/5 font-medium text-foreground"
                data-testid={`badge-task-source-training-${task.taskId}`}
              >
                Обучение
              </Badge>
            ) : null}
            <Badge variant="outline" className={cn("font-medium", zoneTone(task.zone))}>
              Зона {task.zone}
            </Badge>
            {task.insightLabel ? (
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/5 font-medium text-foreground"
                data-testid={`badge-task-source-${task.taskId}`}
              >
                {task.insightLabel}
              </Badge>
            ) : null}
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
          {trainingArticleId ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="min-h-9 border-border bg-card"
              data-testid={`button-task-open-training-material-${task.taskId}`}
            >
              <Link href={`/training/${trainingArticleId}`}>Материал</Link>
            </Button>
          ) : null}
          {task.source === "product_training" && task.trainingProgramId ? (
            <Button
              asChild
              variant="default"
              size="sm"
              className="min-h-9 font-semibold"
              data-testid={`button-task-open-training-${task.taskId}`}
            >
              <Link href={`/training/programs/${task.trainingProgramId}`}>Обучение</Link>
            </Button>
          ) : null}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-9 border-border bg-card"
            data-testid={`button-task-open-related-dealer-${task.taskId}`}
          >
            <Link href={`/dealers/${task.dealerId}`}>Клиент</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-9 border-border bg-card"
            data-testid={`button-task-open-related-trade-point-${task.taskId}`}
          >
            <Link href={`/dealers/${task.dealerId}/trade-points/${task.tradePointId}`}>Точка</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-9 border-border bg-card"
            data-testid={`button-task-open-related-product-${task.taskId}`}
          >
            <Link href={`/catalog/${task.productId}`}>Модель</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LeadershipAttentionCard({ task }: { task: MatrixTaskWithContext }) {
  return (
    <Card
      className="rounded-2xl border border-red-200 bg-red-50/40 shadow-md"
      data-testid={`card-leadership-attention-${task.taskId}`}
    >
      <CardContent className="space-y-2.5 p-4">
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
            {task.insightLabel ? (
              <Badge
                variant="outline"
                className="border-primary/30 bg-primary/5 font-medium text-foreground"
                data-testid={`badge-task-source-${task.taskId}`}
              >
                {task.insightLabel}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge variant="outline" className="border-border bg-card font-medium">
            {MATRIX_TASK_ROLE_LABEL[task.assigneeRole]}
          </Badge>
          <Badge variant="outline" className="border-border bg-card font-medium tabular-nums">
            Срок {task.dueDate}
          </Badge>
          <Badge variant="outline" className={cn("font-medium", zoneTone(task.zone))}>
            Зона {task.zone}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-9 border-border bg-card"
            data-testid={`button-open-leadership-task-dealer-${task.taskId}`}
          >
            <Link href={`/dealers/${task.dealerId}`}>Клиент</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-9 border-border bg-card"
            data-testid={`button-open-leadership-task-trade-point-${task.taskId}`}
          >
            <Link href={`/dealers/${task.dealerId}/trade-points/${task.tradePointId}`}>Точка</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TasksPage() {
  const allTasks = useMemo(() => sortTasks(getAllMatrixTasks()), []);
  const [role, setRole] = useState<RoleViewId>("all");
  const [filter, setFilter] = useState<TasksFilterId>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("cards");

  const roleScopedTasks = useMemo(() => applyRole(allTasks, role), [allTasks, role]);

  const baseList = useMemo(() => {
    if (role === "leadership") return sortLeadership(roleScopedTasks);
    return roleScopedTasks;
  }, [role, roleScopedTasks]);

  const filtered = useMemo(
    () => applySearch(applyFilter(baseList, filter), query),
    [baseList, filter, query],
  );

  const leadershipAttention = useMemo(() => {
    if (role !== "leadership") return [] as MatrixTaskWithContext[];
    return roleScopedTasks
      .filter((t) => t.status === "overdue" || t.priority === "high")
      .slice(0, 8);
  }, [role, roleScopedTasks]);

  const activeRoleView = ROLE_VIEWS.find((r) => r.id === role) ?? ROLE_VIEWS[0];

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

      <div
        className="-mx-4 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
        role="tablist"
        aria-label="Роли и режимы просмотра задач"
      >
        <div className="flex gap-2 pb-1">
          {ROLE_VIEWS.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={role === r.id}
              onClick={() => setRole(r.id)}
              data-testid={r.testId}
              className={cn(
                "min-h-10 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                role === r.id
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <p
        className="text-sm text-muted-foreground"
        data-testid="text-tasks-role-description"
      >
        {activeRoleView.description}
      </p>

      <TasksKpis tasks={roleScopedTasks} />

      {role === "leadership" && leadershipAttention.length > 0 ? (
        <Card
          className="rounded-2xl border border-red-200 bg-card shadow-md"
          data-testid="section-tasks-leadership-attention"
        >
          <CardContent className="space-y-3 pt-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground sm:text-lg">
                Требует внимания руководителя
              </h2>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Просрочки и задачи с высоким приоритетом по команде — выводятся первыми.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {leadershipAttention.map((t) => (
                <LeadershipAttentionCard key={t.taskId} task={t} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

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
        <span className="tabular-nums">{roleScopedTasks.length}</span>
      </p>

      {filtered.length === 0 ? (
        <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
          <CardContent className="pt-5 text-sm text-muted-foreground">
            По выбранным условиям задач нет. Измените роль, фильтр или поисковый запрос.
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

      <FloatingBackButton
        href="/dealer-base"
        label="К клиентской базе"
        testId="floating-back-to-dealer-base"
        ariaLabel="Назад к клиентской базе"
      />
    </div>
  );
}
