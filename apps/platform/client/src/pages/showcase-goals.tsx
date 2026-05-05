import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertCircle, ArrowRightCircle, CheckCircle2, Clock3, Target } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ShowcaseGoalListItem } from "@/lib/api-types";
import { formatDate } from "@/lib/format";
import {
  showcaseGoalSourceLabel,
  showcaseGoalStatusLabel,
  taskPriorityLabel,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

type GoalFilter = "all" | "new" | "in_progress" | "agreed" | "completed" | "overdue";

const filterChips: Array<{ id: GoalFilter; label: string; testId: string }> = [
  { id: "all", label: "Все", testId: "chip-goal-filter-all" },
  { id: "new", label: "Новые", testId: "chip-goal-filter-new" },
  { id: "in_progress", label: "В работе", testId: "chip-goal-filter-in-progress" },
  { id: "agreed", label: "Согласованы", testId: "chip-goal-filter-agreed" },
  { id: "completed", label: "Выполнены", testId: "chip-goal-filter-completed" },
  { id: "overdue", label: "Просрочены", testId: "chip-goal-filter-overdue" },
];

function goalStatusClass(status: ShowcaseGoalListItem["goalStatus"]): string {
  if (status === "completed") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (status === "in_progress") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  if (status === "agreed") {
    return "bg-sky-100 text-sky-800 border-sky-200";
  }
  if (status === "overdue") {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  if (status === "rejected") {
    return "bg-neutral-200 text-neutral-700 border-neutral-300";
  }
  return "bg-primary/15 text-foreground border-primary/35";
}

function priorityClass(priority: ShowcaseGoalListItem["priority"]): string {
  if (priority === "high") {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  if (priority === "medium") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-neutral-100 text-neutral-700 border-neutral-200";
}

export default function ShowcaseGoalsPage() {
  const [filter, setFilter] = useState<GoalFilter>("all");
  const query = useQuery<ShowcaseGoalListItem[]>({
    queryKey: ["/api/sales/showcase-goals"],
  });

  const filteredGoals = useMemo(() => {
    const goals = query.data ?? [];
    if (filter === "all") {
      return goals;
    }
    return goals.filter((goal) => goal.goalStatus === filter);
  }, [query.data, filter]);

  const summary = useMemo(() => {
    const goals = query.data ?? [];
    return {
      total: goals.length,
      inProgress: goals.filter((goal) => goal.goalStatus === "in_progress").length,
      overdue: goals.filter((goal) => goal.goalStatus === "overdue").length,
      completed: goals.filter((goal) => goal.goalStatus === "completed").length,
      targetModels: goals.reduce((sum, goal) => sum + goal.targetModelsCount, 0),
      completedModels: goals.reduce((sum, goal) => sum + goal.completedModelsCount, 0),
    };
  }, [query.data]);

  if (query.isLoading) {
    return (
      <div className="space-y-4" data-testid="page-showcase-goals">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <Alert variant="destructive" data-testid="page-showcase-goals">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить цели по витринам</AlertTitle>
        <AlertDescription>
          {query.error instanceof Error ? query.error.message : "Неизвестная ошибка API"}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-showcase-goals">
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Цели по витринам</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Задачи по выставлению моделей Tandoor, сформированные на основании отчетов дистрибуции
          и работы отдела продаж.
        </p>
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="card-showcase-goals-summary">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Сводка по целям</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Всего целей</p>
            <p className="mt-1 text-xl font-semibold">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">В работе</p>
            <p className="mt-1 text-xl font-semibold">{summary.inProgress}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Просрочено</p>
            <p className="mt-1 text-xl font-semibold">{summary.overdue}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Выполнено</p>
            <p className="mt-1 text-xl font-semibold">{summary.completed}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Моделей к выставлению</p>
            <p className="mt-1 text-xl font-semibold">{summary.targetModels}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Моделей выставлено</p>
            <p className="mt-1 text-xl font-semibold">{summary.completedModels}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {filterChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setFilter(chip.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === chip.id
                ? "border-primary/45 bg-primary/15 text-foreground"
                : "border-border bg-white text-muted-foreground hover:border-border/80",
            )}
            data-testid={chip.testId}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="list-showcase-goals">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Список целей</CardTitle>
          <CardDescription>
            Цели по выставлению моделей в торговых точках дилеров.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredGoals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              По выбранному фильтру целей пока нет.
            </div>
          ) : (
            filteredGoals.map((goal) => (
              <div
                key={goal.id}
                className="rounded-xl border border-border bg-white p-4"
                data-testid={`card-showcase-goal-${goal.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p
                      className="text-base font-semibold text-foreground"
                      data-testid={`text-showcase-goal-title-${goal.id}`}
                    >
                      {goal.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {goal.dealer.name} · {goal.tradePoint.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ответственный:{" "}
                      {goal.assignedTo
                        ? `${goal.assignedTo.firstName} ${goal.assignedTo.lastName}`
                        : "Не назначен"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={goalStatusClass(goal.goalStatus)}>
                      {showcaseGoalStatusLabel(goal.goalStatus)}
                    </Badge>
                    <Badge variant="outline" className={priorityClass(goal.priority)}>
                      {taskPriorityLabel(goal.priority)}
                    </Badge>
                    <Badge variant="outline" className="bg-primary/10 text-foreground border-primary/25">
                      {showcaseGoalSourceLabel(goal.source)}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Срок</p>
                    <p className="mt-1 font-medium">{formatDate(goal.dueDate)}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Прогресс</p>
                    <p
                      className="mt-1 font-medium"
                      data-testid={`text-showcase-goal-progress-${goal.id}`}
                    >
                      {goal.completedModelsCount} / {goal.targetModelsCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Выполнение</p>
                    <p className="mt-1 font-medium">{goal.progressPercent}%</p>
                  </div>
                </div>
                <Button
                  asChild
                  className="mt-4 rounded-xl"
                  data-testid={`button-open-showcase-goal-${goal.id}`}
                >
                  <Link href={`/sales/showcase-goals/${goal.id}`}>
                    Открыть цель
                    <ArrowRightCircle className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card
        className="rounded-2xl border-border/80 shadow-sm"
        data-testid="section-showcase-goal-process"
      >
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Как формируются цели</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          Региональный менеджер фиксирует фактическую дистрибуцию в ТТ. Если модели отсутствуют
          или не выставлены на витрине, система формирует цель для отдела продаж. Менеджер продаж
          согласует выставление с дилером, ассистент готовит материалы, РМ проверяет выполнение при
          следующем визите.
        </CardContent>
      </Card>
    </div>
  );
}
