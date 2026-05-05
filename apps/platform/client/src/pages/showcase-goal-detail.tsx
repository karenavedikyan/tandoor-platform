import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { AlertCircle, ArrowLeft, CheckCircle2, PlayCircle, ThumbsUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";
import { apiRequest } from "@/lib/queryClient";
import type { ShowcaseGoalDetail, ShowcaseGoalStatusUpdateResponse } from "@/lib/api-types";
import {
  salesTaskStatusLabel,
  salesTaskTypeLabel,
  showcaseGoalCurrentStateLabel,
  showcaseGoalItemStatusLabel,
  showcaseGoalSourceLabel,
  showcaseGoalStatusLabel,
  showcaseGoalTargetStateLabel,
  taskPriorityLabel,
} from "@/lib/labels";

function statusBadgeClass(status: string): string {
  if (status === "completed") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "in_progress") return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "overdue") return "bg-rose-100 text-rose-800 border-rose-200";
  if (status === "agreed") return "bg-sky-100 text-sky-900 border-sky-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function priorityBadgeClass(priority: string): string {
  if (priority === "high") return "bg-rose-100 text-rose-800 border-rose-200";
  if (priority === "medium") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function ShowcaseGoalDetailPage() {
  const [match, params] = useRoute("/sales/showcase-goals/:id");
  const goalId = match ? Number.parseInt(params.id, 10) : Number.NaN;
  const { toast } = useToast();

  const query = useQuery<ShowcaseGoalDetail>({
    queryKey: ["/api/sales/showcase-goals", String(goalId)],
    enabled: Number.isFinite(goalId),
  });

  const statusMutation = useMutation({
    mutationFn: async (status: "in_progress" | "agreed" | "completed") => {
      const response = await apiRequest(
        "POST",
        `/api/sales/showcase-goals/${goalId}/status`,
        { status },
      );
      return (await response.json()) as ShowcaseGoalStatusUpdateResponse;
    },
    onSuccess: () => {
      toast({ title: "Статус цели обновлен" });
      void query.refetch();
    },
  });

  const progressPercent = useMemo(() => {
    const goal = query.data?.goal;
    if (!goal || goal.targetModelsCount <= 0) {
      return 0;
    }
    return Math.min(
      100,
      Math.round((goal.completedModelsCount / goal.targetModelsCount) * 100),
    );
  }, [query.data]);

  if (!Number.isFinite(goalId)) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Некорректный ID цели</AlertTitle>
        <AlertDescription>Откройте цель из списка целей по витринам.</AlertDescription>
      </Alert>
    );
  }

  if (query.isLoading) {
    return (
      <div className="space-y-4" data-testid="page-showcase-goal-detail">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <Alert variant="destructive" data-testid="page-showcase-goal-detail">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить цель</AlertTitle>
        <AlertDescription>
          {query.error instanceof Error ? query.error.message : "Неизвестная ошибка"}
        </AlertDescription>
      </Alert>
    );
  }

  const detail = query.data;
  if (!detail) {
    return (
      <Alert data-testid="page-showcase-goal-detail">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Цель не найдена</AlertTitle>
        <AlertDescription>Запрошенная цель отсутствует в демо-данных.</AlertDescription>
      </Alert>
    );
  }

  const goal = detail.goal;
  const isMutating = statusMutation.isPending;

  return (
    <div className="space-y-6" data-testid="page-showcase-goal-detail">
      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader className="space-y-3">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-fit rounded-xl"
            data-testid="button-back-showcase-goals"
          >
            <Link href="/sales/showcase-goals">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад к целям
            </Link>
          </Button>
          <div className="space-y-2">
            <CardTitle className="text-xl">{goal.title}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={statusBadgeClass(goal.goalStatus)}>
                {showcaseGoalStatusLabel(goal.goalStatus)}
              </Badge>
              <Badge variant="outline" className={priorityBadgeClass(goal.priority)}>
                {taskPriorityLabel(goal.priority)}
              </Badge>
              <Badge variant="outline" className="bg-primary/10 text-foreground border-primary/25">
                Срок: {formatDate(goal.dueDate)}
              </Badge>
              <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                Источник: {showcaseGoalSourceLabel(goal.source)}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-showcase-goal-context">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Контекст</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Дилер</p>
            <p className="mt-1 font-semibold">{detail.dealer.name}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Торговая точка</p>
            <p className="mt-1 font-semibold">{detail.tradePoint.name}</p>
            <p className="mt-1 text-muted-foreground">
              {detail.tradePoint.city}, {detail.tradePoint.address}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Ответственный менеджер</p>
            <p className="mt-1 font-semibold">
              {detail.assignedTo
                ? `${detail.assignedTo.firstName} ${detail.assignedTo.lastName}`
                : "Не назначен"}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Создал цель</p>
            <p className="mt-1 font-semibold">
              {detail.createdBy
                ? `${detail.createdBy.firstName} ${detail.createdBy.lastName}`
                : "Не указано"}
            </p>
          </div>
          {detail.sourceDistributionReportSummary ? (
            <div className="rounded-xl border border-border bg-white p-3 sm:col-span-2">
              <p className="text-xs text-muted-foreground">Источник: отчет дистрибуции</p>
              <p className="mt-1 font-semibold">
                Визит #{detail.sourceDistributionReportSummary.visitId} · отсутствует{" "}
                {detail.sourceDistributionReportSummary.missingModelsCount} моделей
              </p>
              <p className="mt-1 text-muted-foreground">
                {detail.sourceDistributionReportSummary.recommendation}
              </p>
            </div>
          ) : null}
          <Button asChild variant="outline" className="rounded-xl lg:col-span-1">
            <Link href={`/dealers/${detail.dealer.id}`}>Открыть карточку дилера</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-showcase-goal-progress">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Прогресс цели</CardTitle>
          <CardDescription>
            Выставлено {goal.completedModelsCount} из {goal.targetModelsCount} моделей
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={progressPercent} className="h-3" data-testid="progress-showcase-goal" />
          <p className="text-sm text-muted-foreground">
            Выставлено {goal.completedModelsCount} из {goal.targetModelsCount} моделей
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-showcase-goal-items">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Модели к выставлению</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {detail.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              По цели пока нет моделей.
            </div>
          ) : (
            detail.items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-white p-4"
                data-testid={`row-showcase-goal-item-${item.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{item.modelName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.sku} · {item.category}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                    {showcaseGoalItemStatusLabel(item.itemStatus)}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Текущее состояние:</span>{" "}
                    {showcaseGoalCurrentStateLabel(item.currentState)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Целевое состояние:</span>{" "}
                    {showcaseGoalTargetStateLabel(item.targetState)}
                  </p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.comment ?? "Комментарий отсутствует"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-related-sales-tasks">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">
            Связанные задачи отдела продаж
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {detail.relatedSalesTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Связанные задачи пока не созданы.
            </div>
          ) : (
            detail.relatedSalesTasks.map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-border bg-white p-4"
                data-testid={`card-related-sales-task-${task.id}`}
              >
                <p className="font-semibold text-foreground">{task.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {task.assignedTo
                    ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
                    : "Не назначен"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                    {salesTaskTypeLabel(task.taskType)}
                  </Badge>
                  <Badge variant="outline" className={priorityBadgeClass(task.priority)}>
                    {taskPriorityLabel(task.priority)}
                  </Badge>
                  <Badge variant="outline" className={statusBadgeClass(task.taskStatus)}>
                    {salesTaskStatusLabel(task.taskStatus)}
                  </Badge>
                  <Badge variant="outline" className="bg-primary/10 text-foreground border-primary/25">
                    Срок: {formatDate(task.dueDate)}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Действия</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            onClick={() => statusMutation.mutate("in_progress")}
            disabled={isMutating}
            className="rounded-xl"
            data-testid="button-goal-status-in-progress"
          >
            <PlayCircle className="mr-2 h-4 w-4" />
            Взять в работу
          </Button>
          <Button
            onClick={() => statusMutation.mutate("agreed")}
            disabled={isMutating}
            variant="outline"
            className="rounded-xl bg-white"
            data-testid="button-goal-status-agreed"
          >
            <ThumbsUp className="mr-2 h-4 w-4" />
            Согласовано с дилером
          </Button>
          <Button
            onClick={() => statusMutation.mutate("completed")}
            disabled={isMutating}
            variant="outline"
            className="rounded-xl bg-white"
            data-testid="button-goal-status-completed"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Отметить выполненной
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-xl bg-white"
            data-testid="button-return-showcase-goals"
          >
            <Link href="/sales/showcase-goals">Вернуться к списку</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
