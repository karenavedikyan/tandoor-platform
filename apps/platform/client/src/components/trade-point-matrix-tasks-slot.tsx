import type { ComponentProps, ReactNode } from "react";
import { useMemo } from "react";
import { Link } from "wouter";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  summarizeMatrixTasks,
  MATRIX_TASK_PRIORITY_LABEL,
  MATRIX_TASK_ROLE_LABEL,
  MATRIX_TASK_STATUS_LABEL,
  MATRIX_TASK_TYPE_LABEL,
  type MatrixTask,
  type MatrixTaskStatus,
} from "@/lib/trade-point-task-data";

export type MatrixTaskFilterId = "all" | "new" | "in_progress" | "overdue" | "high";

export const MATRIX_TASK_FILTERS: { id: MatrixTaskFilterId; label: string; testId: string }[] = [
  { id: "all", label: "Все", testId: "filter-trade-point-tasks-matrix-all" },
  { id: "new", label: "Новые", testId: "filter-trade-point-tasks-matrix-new" },
  { id: "in_progress", label: "В работе", testId: "filter-trade-point-tasks-matrix-in-progress" },
  { id: "overdue", label: "Просрочено", testId: "filter-trade-point-tasks-matrix-overdue" },
  { id: "high", label: "Высокий приоритет", testId: "filter-trade-point-tasks-matrix-high" },
];

export function taskStatusTone(status: MatrixTaskStatus) {
  if (status === "new") return "border-primary/40 bg-primary/10 text-primary";
  if (status === "in_progress") return "border-amber-200 bg-amber-50 text-amber-950";
  if (status === "overdue") return "border-red-200 bg-red-50 text-red-900";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

export function taskPriorityTone(priority: MatrixTask["priority"]) {
  if (priority === "high") return "border-red-200 bg-red-50 text-red-900";
  if (priority === "medium") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted text-muted-foreground";
}

function SurfaceCard({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & ComponentProps<typeof Card>) {
  return (
    <Card className={cn("rounded-2xl border border-border/80 bg-card shadow-md", className)} {...rest}>
      {children}
    </Card>
  );
}

export function MatrixTaskSummaryCard({
  tasks,
  testId = "card-trade-point-matrix-task-summary",
}: {
  tasks: MatrixTask[];
  testId?: string;
}) {
  const summary = useMemo(() => summarizeMatrixTasks(tasks), [tasks]);
  const tiles = [
    { label: "Всего", value: summary.total, tone: "border-border bg-muted/40 text-foreground" },
    { label: "Новые", value: summary.newCount, tone: "border-primary/40 bg-primary/10 text-primary" },
    { label: "В работе", value: summary.inProgressCount, tone: "border-amber-200 bg-amber-50 text-amber-950" },
    { label: "Просрочено", value: summary.overdueCount, tone: "border-red-200 bg-red-50 text-red-900" },
    { label: "Высокий приоритет", value: summary.highPriorityCount, tone: "border-border bg-card text-foreground" },
  ];
  return (
    <SurfaceCard data-testid={testId}>
      <CardContent className="space-y-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Сводка по задачам матрицы
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {tiles.map((t) => (
            <div key={t.label} className={cn("rounded-xl border px-3 py-2.5", t.tone)}>
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{t.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{t.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </SurfaceCard>
  );
}

export function MatrixTaskCard({
  task,
  expanded,
  onToggle,
}: {
  task: MatrixTask;
  expanded: boolean;
  onToggle: (taskId: string) => void;
}) {
  return (
    <SurfaceCard data-testid={`card-matrix-task-${task.taskId}`} id={`card-matrix-task-${task.taskId}`}>
      <CardHeader className="space-y-2 pb-2 pt-4">
        <CardTitle className="text-base font-semibold leading-snug">{task.title}</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={cn("font-medium", taskPriorityTone(task.priority))}>
            {MATRIX_TASK_PRIORITY_LABEL[task.priority]}
          </Badge>
          <Badge variant="outline" className={cn("font-medium", taskStatusTone(task.status))}>
            {MATRIX_TASK_STATUS_LABEL[task.status]}
          </Badge>
          <Badge variant="outline" className="border-border bg-muted/60 font-medium">
            {MATRIX_TASK_TYPE_LABEL[task.type]}
          </Badge>
          <Badge variant="outline" className="border-border bg-card font-medium">
            Зона {task.zone}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-4 text-sm text-muted-foreground">
        <div className="grid gap-2 sm:grid-cols-2">
          <p>
            <span className="font-semibold text-foreground">Срок:</span> {task.dueDate}
          </p>
          <p>
            <span className="font-semibold text-foreground">Ответственный:</span>{" "}
            {MATRIX_TASK_ROLE_LABEL[task.assigneeRole]}
          </p>
          <p>
            <span className="font-semibold text-foreground">Точка:</span> {task.tradePointName}
          </p>
          <p>
            <span className="font-semibold text-foreground">Образцы:</span>{" "}
            <span className="tabular-nums">
              {task.actualSamples} / {task.targetSamples}
            </span>
          </p>
        </div>
        {expanded ? (
          <div className="rounded-xl border border-border bg-muted/40 p-3 text-foreground">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Описание</p>
            <p className="mt-1 text-sm leading-relaxed">{task.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Источник: матрица товаров · {task.portal}
            </p>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="outline"
            className="min-h-10 w-full border-border bg-card sm:w-auto"
            data-testid={`button-expand-matrix-task-${task.taskId}`}
            onClick={() => onToggle(task.taskId)}
          >
            {expanded ? (
              <>
                <ChevronUp className="mr-1.5 h-4 w-4" aria-hidden /> Свернуть
              </>
            ) : (
              <>
                <ChevronDown className="mr-1.5 h-4 w-4" aria-hidden /> Подробнее
              </>
            )}
          </Button>
          <Button
            asChild
            variant="outline"
            className="min-h-10 w-full border-border bg-card sm:w-auto"
            data-testid={`button-open-matrix-task-${task.taskId}`}
          >
            <Link href={`/catalog/${task.productId}`}>Открыть модель</Link>
          </Button>
        </div>
      </CardContent>
    </SurfaceCard>
  );
}

export function MatrixTasksSlot({
  createdTasks,
  matrixTaskFilter,
  onFilterChange,
  expandedTaskIds,
  onToggleTask,
  filteredCreatedTasks,
}: {
  createdTasks: MatrixTask[];
  matrixTaskFilter: MatrixTaskFilterId;
  onFilterChange: (id: MatrixTaskFilterId) => void;
  expandedTaskIds: Set<string>;
  onToggleTask: (taskId: string) => void;
  filteredCreatedTasks: MatrixTask[];
}) {
  return (
    <div className="space-y-2" data-testid="section-trade-point-matrix-created-tasks-embedded">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Созданные задачи по матрице товаров
      </p>
      <MatrixTaskSummaryCard tasks={createdTasks} testId="card-trade-point-matrix-task-summary" />
      {createdTasks.length > 0 ? (
        <div
          className="-mx-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:px-0"
          role="tablist"
          aria-label="Фильтры задач по матрице"
          data-testid="filter-trade-point-tasks-matrix"
        >
          <div className="flex flex-wrap gap-2 pb-1">
            {MATRIX_TASK_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={matrixTaskFilter === f.id}
                onClick={() => onFilterChange(f.id)}
                data-testid={f.testId}
                className={cn(
                  "min-h-9 shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                  matrixTaskFilter === f.id
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {createdTasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Пока нет созданных задач по матрице — создайте из блока «Фактическая витрина» ниже.
        </p>
      ) : filteredCreatedTasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">По выбранному фильтру задач нет.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filteredCreatedTasks.map((task) => (
            <MatrixTaskCard
              key={task.taskId}
              task={task}
              expanded={expandedTaskIds.has(task.taskId)}
              onToggle={onToggleTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}
