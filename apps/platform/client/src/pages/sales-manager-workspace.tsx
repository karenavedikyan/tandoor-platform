import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRightCircle, BriefcaseBusiness, Clock3 } from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { SalesManagerWorkspace } from "@/lib/api-types";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  dealerStatusLabel,
  dealerTypeLabel,
  managerOverdueTypeLabel,
  potentialLevelLabel,
  quickActionTypeLabel,
  regionalSignalTypeLabel,
  salesTaskStatusLabel,
  salesTaskTypeLabel,
  showcaseGoalStatusLabel,
  taskPriorityLabel,
  todayFocusSourceLabel,
  todayFocusTypeLabel,
} from "@/lib/labels";

function priorityClass(priority: string): string {
  if (priority === "high") {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  if (priority === "medium") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function statusClass(status: string): string {
  if (status === "done" || status === "completed") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (status === "in_progress") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  if (status === "overdue") {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  if (status === "waiting_dealer") {
    return "bg-sky-100 text-sky-800 border-sky-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function overdueSeverityClass(severity: string): string {
  if (severity === "critical") {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  if (severity === "high") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function SalesManagerWorkspacePage() {
  const workspaceQuery = useQuery<SalesManagerWorkspace>({
    queryKey: ["/api/sales/manager-workspace"],
  });

  if (workspaceQuery.isLoading) {
    return (
      <div className="space-y-4" data-testid="page-sales-manager-workspace">
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (workspaceQuery.isError) {
    return (
      <Alert variant="destructive" data-testid="page-sales-manager-workspace">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить рабочий стол менеджера продаж</AlertTitle>
        <AlertDescription>
          {workspaceQuery.error instanceof Error
            ? workspaceQuery.error.message
            : "Ошибка получения данных рабочего стола"}
        </AlertDescription>
      </Alert>
    );
  }

  const workspace = workspaceQuery.data;
  if (!workspace) {
    return (
      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="page-sales-manager-workspace">
        <CardHeader>
          <CardTitle>Данные рабочего стола недоступны</CardTitle>
          <CardDescription>
            Для менеджера продаж пока нет данных в demo-режиме.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-sales-manager-workspace">
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Рабочий стол менеджера продаж</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ежедневный фокус по дилерам, целям по витринам, задачам и сигналам от региональных
          менеджеров.
        </p>
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="card-sales-manager-profile">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Профиль менеджера</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-base font-semibold">{workspace.manager.name}</p>
            <p className="text-sm text-muted-foreground">
              {workspace.manager.role} · {workspace.manager.team}
            </p>
            <p className="text-sm text-muted-foreground">{workspace.manager.region}</p>
            <p className="text-sm text-muted-foreground">{workspace.manager.email}</p>
            <p className="text-sm text-muted-foreground">{workspace.manager.phone}</p>
          </div>
          <div className="rounded-xl border border-border bg-[#f5f5f5] p-3 text-sm text-muted-foreground">
            Сегодня в фокусе: цели по витринам и follow-up по дилерам
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="card-manager-workspace-kpis">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Ключевые показатели</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-white p-3" data-testid="kpi-manager-dealers">
            <p className="text-xs text-muted-foreground">Мои дилеры</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.assignedDealersCount}</p>
          </div>
          <div
            className="rounded-xl border border-border bg-white p-3"
            data-testid="kpi-manager-active-goals"
          >
            <p className="text-xs text-muted-foreground">Активные цели</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.activeGoalsCount}</p>
          </div>
          <div
            className="rounded-xl border border-border bg-white p-3"
            data-testid="kpi-manager-active-tasks"
          >
            <p className="text-xs text-muted-foreground">Активные задачи</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.activeTasksCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3" data-testid="kpi-manager-overdue">
            <p className="text-xs text-muted-foreground">Просрочено</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.overdueTasksCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3" data-testid="kpi-manager-today">
            <p className="text-xs text-muted-foreground">На сегодня</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.todayTasksCount}</p>
          </div>
          <div
            className="rounded-xl border border-border bg-white p-3"
            data-testid="kpi-manager-high-priority"
          >
            <p className="text-xs text-muted-foreground">Высокий приоритет</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.highPriorityItemsCount}</p>
          </div>
          <div
            className="rounded-xl border border-border bg-white p-3"
            data-testid="kpi-manager-stale-dealers"
          >
            <p className="text-xs text-muted-foreground">Без активности</p>
            <p className="mt-1 text-xl font-semibold">
              {workspace.kpis.dealersWithoutRecentActivityCount}
            </p>
          </div>
          <div
            className="rounded-xl border border-border bg-white p-3"
            data-testid="kpi-manager-open-orders"
          >
            <p className="text-xs text-muted-foreground">Открытые заказы</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.openOrdersCount}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-today-focus">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Сегодня в работе</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspace.todayFocus.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              На сегодня задач в фокусе нет.
            </div>
          ) : (
            workspace.todayFocus.map((item) => (
              <div
                key={item.id}
                className="space-y-3 rounded-xl border border-border bg-white p-4"
                data-testid={`card-today-focus-${item.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.dealerName}
                      {item.tradePointName ? ` · ${item.tradePointName}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={statusClass(item.status)}>
                      {salesTaskStatusLabel(item.status)}
                    </Badge>
                    <Badge variant="outline" className={priorityClass(item.priority)}>
                      {taskPriorityLabel(item.priority)}
                    </Badge>
                  </div>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <p>
                    <span className="text-muted-foreground">Тип:</span> {todayFocusTypeLabel(item.type)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Источник:</span>{" "}
                    {todayFocusSourceLabel(item.source)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Срок:</span> {formatDate(item.dueDate)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Время:</span> {item.dueTime ?? "—"}
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-xl"
                  data-testid={`button-open-today-focus-${item.id}`}
                >
                  <Link href={item.href}>
                    Открыть
                    <ArrowRightCircle className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-assigned-dealers">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Мои дилеры</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspace.assignedDealers.map((dealer) => (
            <div
              key={dealer.dealerId}
              className="space-y-3 rounded-xl border border-border bg-white p-4"
              data-testid={`card-assigned-dealer-${dealer.dealerId}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold">{dealer.dealerName}</p>
                  <p className="text-sm text-muted-foreground">
                    {dealer.city} · {dealer.segment}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{dealerTypeLabel(dealer.dealerType)}</Badge>
                  <Badge variant="outline">{dealerStatusLabel(dealer.status)}</Badge>
                  <Badge variant="outline">{potentialLevelLabel(dealer.potentialLevel)}</Badge>
                </div>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <p>ТТ: {dealer.tradePointCount}</p>
                <p>Активные цели: {dealer.activeGoalsCount}</p>
                <p>Активные задачи: {dealer.activeTasksCount}</p>
                <p>Просрочки: {dealer.overdueTasksCount}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Последняя активность: {formatDateTime(dealer.lastInteractionDate)}
              </p>
              <p className="text-sm text-muted-foreground">Следующее действие: {dealer.nextAction}</p>
              <Button
                asChild
                variant="outline"
                className="rounded-xl"
                data-testid={`button-open-assigned-dealer-${dealer.dealerId}`}
              >
                <Link href={dealer.href}>
                  Открыть дилера
                  <ArrowRightCircle className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card
        className="rounded-2xl border-border/80 shadow-sm"
        data-testid="section-manager-showcase-goals"
      >
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Цели по витринам</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspace.activeShowcaseGoals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Активных целей по витринам нет.
            </div>
          ) : (
            workspace.activeShowcaseGoals.map((goal) => {
              const progressPercent =
                goal.targetModelsCount > 0
                  ? Math.min(100, Math.round((goal.completedModelsCount / goal.targetModelsCount) * 100))
                  : 0;
              return (
                <div
                  key={goal.id}
                  className="space-y-3 rounded-xl border border-border bg-white p-4"
                  data-testid={`card-manager-showcase-goal-${goal.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold">{goal.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {goal.dealerName} · {goal.tradePointName}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={statusClass(goal.status)}>
                        {showcaseGoalStatusLabel(goal.status)}
                      </Badge>
                      <Badge variant="outline" className={priorityClass(goal.priority)}>
                        {taskPriorityLabel(goal.priority)}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <p>Срок: {formatDate(goal.dueDate)}</p>
                    <p>Прогресс: {goal.progressText}</p>
                  </div>
                  <Progress value={progressPercent} className="h-2 bg-muted" />
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-xl"
                    data-testid={`button-open-manager-showcase-goal-${goal.id}`}
                  >
                    <Link href={goal.href}>
                      Открыть цель
                      <ArrowRightCircle className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-manager-sales-tasks">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Мои задачи</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspace.salesTasks.map((task) => (
            <div
              key={task.id}
              className="space-y-3 rounded-xl border border-border bg-white p-4"
              data-testid={`card-manager-sales-task-${task.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold">{task.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {task.dealerName}
                    {task.tradePointName ? ` · ${task.tradePointName}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={statusClass(task.status)}>
                    {salesTaskStatusLabel(task.status)}
                  </Badge>
                  <Badge variant="outline" className={priorityClass(task.priority)}>
                    {taskPriorityLabel(task.priority)}
                  </Badge>
                </div>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <p>Тип: {salesTaskTypeLabel(task.taskType)}</p>
                <p>Срок: {formatDate(task.dueDate)}</p>
                <p>Связь с целью: {task.showcaseGoalId ? `#${task.showcaseGoalId}` : "Нет"}</p>
              </div>
              <Button
                asChild
                variant="outline"
                className="rounded-xl"
                data-testid={`button-open-manager-sales-task-${task.id}`}
              >
                <Link href={task.href}>
                  Открыть
                  <ArrowRightCircle className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-manager-overdue">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Просрочки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspace.overdueItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Просрочек нет. Отличный темп работы.
            </div>
          ) : (
            workspace.overdueItems.map((item) => (
              <div
                key={item.id}
                className="space-y-2 rounded-xl border border-border bg-white p-4"
                data-testid={`card-manager-overdue-${item.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">{managerOverdueTypeLabel(item.type)}</p>
                    <p className="text-base font-semibold">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.dealerName}</p>
                  </div>
                  <Badge variant="outline" className={overdueSeverityClass(item.severity)}>
                    {item.severity}
                  </Badge>
                </div>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock3 className="h-4 w-4" />
                  Срок: {formatDate(item.dueDate)}
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-xl"
                  data-testid={`button-open-manager-overdue-${item.id}`}
                >
                  <Link href={item.href}>
                    Открыть
                    <ArrowRightCircle className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-stale-dealers">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Дилеры без активности</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspace.staleDealers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Дилеров без активности не обнаружено.
            </div>
          ) : (
            workspace.staleDealers.map((dealer) => (
              <div
                key={dealer.dealerId}
                className="space-y-2 rounded-xl border border-border bg-white p-4"
                data-testid={`card-stale-dealer-${dealer.dealerId}`}
              >
                <p className="text-base font-semibold">{dealer.dealerName}</p>
                <p className="text-sm text-muted-foreground">{dealer.city}</p>
                <p className="text-sm text-muted-foreground">
                  Последняя активность: {formatDateTime(dealer.lastInteractionDate)}
                </p>
                <p className="text-sm text-muted-foreground">Дней без активности: {dealer.daysWithoutActivity}</p>
                <p className="text-sm text-muted-foreground">Причина риска: {dealer.riskReason}</p>
                <p className="text-sm text-muted-foreground">Следующий шаг: {dealer.nextAction}</p>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-xl"
                  data-testid={`button-open-stale-dealer-${dealer.dealerId}`}
                >
                  <Link href={dealer.href}>
                    Открыть дилера
                    <ArrowRightCircle className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-regional-signals">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">
            Сигналы от регионального менеджера
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspace.regionalSignals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Новых сигналов от РМ нет.
            </div>
          ) : (
            workspace.regionalSignals.map((signal) => (
              <div
                key={signal.id}
                className="space-y-2 rounded-xl border border-border bg-white p-4"
                data-testid={`card-regional-signal-${signal.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {regionalSignalTypeLabel(signal.sourceType)}
                    </p>
                    <p className="text-base font-semibold">{signal.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {signal.dealerName} · {signal.tradePointName}
                    </p>
                  </div>
                  <Badge variant="outline" className={priorityClass(signal.priority)}>
                    {taskPriorityLabel(signal.priority)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{signal.summary}</p>
                <p className="text-sm text-muted-foreground">Дата: {formatDateTime(signal.createdAt)}</p>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-xl"
                  data-testid={`button-open-regional-signal-${signal.id}`}
                >
                  <Link href={signal.href}>
                    Открыть источник
                    <ArrowRightCircle className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-manager-quick-actions">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Быстрые действия</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {workspace.quickActions.map((action) => {
            const testId =
              action.actionType === "open_showcase_goals"
                ? "button-manager-open-showcase-goals"
                : action.actionType === "open_sales_tasks"
                  ? "button-manager-open-sales-tasks"
                  : action.actionType === "open_dealers"
                    ? "button-manager-open-dealers"
                    : action.actionType === "open_leadership"
                      ? "button-manager-open-leadership"
                      : action.actionType === "open_regional_route"
                        ? "button-manager-open-regional-route"
                        : undefined;

            return (
              <Button
                key={action.actionType}
                asChild
                variant="outline"
                className="h-12 justify-between rounded-xl bg-white"
                data-testid={testId}
              >
                <Link href={action.href}>
                  <span className="text-left">
                    <span className="block text-sm font-medium">{action.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {quickActionTypeLabel(action.actionType)}
                    </span>
                  </span>
                  <ArrowRightCircle className="h-4 w-4" />
                </Link>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 bg-[#f5f5f5] shadow-sm">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <BriefcaseBusiness className="mt-0.5 h-4 w-4 text-primary" />
          <p>
            Операционный контур менеджера продаж собран в одном месте: дилеры, цели, задачи,
            просрочки и сигналы РМ.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
