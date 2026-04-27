import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRightCircle,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  MapPin,
  Route as RouteIcon,
  Target,
} from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { RegionalManagerWorkspace } from "@/lib/api-types";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  distributionFocusPriorityLabel,
  priorityLabel,
  regionalActivityTypeLabel,
  regionalTaskTypeLabel,
  riskLevelLabel,
  routeStatusLabel,
  showcaseGoalStatusLabel,
  visitStatusLabel,
} from "@/lib/labels";

function statusClass(status: string): string {
  if (status === "completed" || status === "done") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  if (status === "in_progress") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  if (status === "overdue" || status === "skipped") {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function priorityClass(priority: string): string {
  if (priority === "high") return "bg-rose-100 text-rose-800 border-rose-200";
  if (priority === "medium") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function riskClass(level: string): string {
  if (level === "critical") return "bg-rose-100 text-rose-800 border-rose-200";
  if (level === "high") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-sky-100 text-sky-800 border-sky-200";
}

export default function RegionalManagerWorkspacePage() {
  const workspaceQuery = useQuery<RegionalManagerWorkspace>({
    queryKey: ["/api/regional-manager/workspace"],
  });

  const tasks = workspaceQuery.data?.tasks;
  const taskStats = useMemo(
    () => ({
      done: tasks?.filter((task) => task.status === "done").length ?? 0,
      active: tasks?.filter((task) => task.status === "in_progress").length ?? 0,
      overdue: tasks?.filter((task) => task.status === "overdue").length ?? 0,
    }),
    [tasks],
  );

  if (workspaceQuery.isLoading) {
    return (
      <div className="space-y-4" data-testid="page-regional-manager-workspace">
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  if (workspaceQuery.isError) {
    return (
      <Alert variant="destructive" data-testid="page-regional-manager-workspace">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить ЛК регионального менеджера</AlertTitle>
        <AlertDescription>
          {workspaceQuery.error instanceof Error
            ? workspaceQuery.error.message
            : "Ошибка получения данных рабочего стола регионального менеджера."}
        </AlertDescription>
      </Alert>
    );
  }

  const workspace = workspaceQuery.data;
  if (!workspace) {
    return (
      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="page-regional-manager-workspace">
        <CardHeader>
          <CardTitle>Данные рабочего стола недоступны</CardTitle>
          <CardDescription>Для регионального менеджера пока нет данных в demo-режиме.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const nextVisitHref = workspace.todayRoute.nextVisitId
    ? `/regional-manager/visits/${workspace.todayRoute.nextVisitId}`
    : "/regional-manager/route";

  return (
    <div className="space-y-6" data-testid="page-regional-manager-workspace">
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">ЛК регионального менеджера</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Единая рабочая зона: маршрут, визиты, отчеты дистрибуции, риски дилеров и цели по
              витринам.
            </p>
          </div>
          <Button asChild className="h-10 rounded-xl" data-testid="button-open-current-route">
            <Link href="/regional-manager/route">
              Открыть маршрут
              <ArrowRightCircle className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Профиль регионала</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Имя</p>
            <p className="mt-1 font-semibold">{workspace.manager.name}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Роль</p>
            <p className="mt-1 font-semibold">{workspace.manager.role}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Регион</p>
            <p className="mt-1 font-semibold">{workspace.manager.region}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Команда</p>
            <p className="mt-1 font-semibold">{workspace.manager.teamName}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3 sm:col-span-2 lg:col-span-2">
            <p className="text-xs text-muted-foreground">Период</p>
            <p className="mt-1 font-semibold">{workspace.period.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(workspace.period.dateFrom)} — {formatDate(workspace.period.dateTo)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">KPI</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-border bg-white p-3" data-testid="metric-regional-planned-visits">
            <p className="text-xs text-muted-foreground">Визитов запланировано</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.plannedVisits}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3" data-testid="metric-regional-completed-visits">
            <p className="text-xs text-muted-foreground">Визитов выполнено</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.completedVisits}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">В работе</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.inProgressVisits}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Просрочено визитов</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.overdueVisits}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3" data-testid="metric-regional-distribution-reports">
            <p className="text-xs text-muted-foreground">Отчетов дистрибуции</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.distributionReports}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3" data-testid="metric-regional-missing-models">
            <p className="text-xs text-muted-foreground">Отсутствующих моделей</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.missingModels}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3" data-testid="metric-regional-showcase-goals">
            <p className="text-xs text-muted-foreground">Целей по витринам создано</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.showcaseGoalsCreated}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3" data-testid="metric-regional-open-tasks">
            <p className="text-xs text-muted-foreground">Открытых задач</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.openTasks}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Просроченных задач</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.overdueTasks}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3" data-testid="metric-regional-at-risk-dealers">
            <p className="text-xs text-muted-foreground">Дилеров в зоне риска</p>
            <p className="mt-1 text-xl font-semibold">{workspace.kpis.atRiskDealers}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-regional-today-route">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Маршрут на сегодня</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-xs text-muted-foreground">Маршрут</p>
              <p className="mt-1 font-semibold">{workspace.todayRoute.title}</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-xs text-muted-foreground">Город</p>
              <p className="mt-1 font-semibold">{workspace.todayRoute.city}</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-xs text-muted-foreground">Дата</p>
              <p className="mt-1 font-semibold">{formatDate(workspace.todayRoute.date)}</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-xs text-muted-foreground">Статус</p>
              <Badge variant="outline" className={`mt-2 ${statusClass(workspace.todayRoute.status)}`}>
                {routeStatusLabel(workspace.todayRoute.status)}
              </Badge>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Прогресс маршрута</p>
              <p className="text-sm text-muted-foreground">{workspace.todayRoute.progressPercent}%</p>
            </div>
            <Progress value={workspace.todayRoute.progressPercent} className="mt-3 h-2 bg-muted" />
            <p className="mt-2 text-sm text-muted-foreground">
              Выполнено визитов: {workspace.todayRoute.visitsCompleted}/{workspace.todayRoute.visitsTotal}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-xs text-muted-foreground">Следующий визит</p>
              <p className="mt-1 font-semibold">{workspace.todayRoute.nextDealerName ?? "Нет визитов в очереди"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {workspace.todayRoute.nextTradePointAddress ?? "Адрес не указан"}
              </p>
            </div>
            <div className="grid gap-3">
              <Button asChild className="h-11 justify-between rounded-xl">
                <Link href="/regional-manager/route">
                  Открыть маршрут
                  <RouteIcon className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 justify-between rounded-xl bg-white"
                data-testid="button-start-next-visit"
              >
                <Link href={nextVisitHref}>
                  Начать следующий визит
                  <ArrowRightCircle className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-regional-upcoming-visits">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Ближайшие визиты</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspace.upcomingVisits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Визиты на период не запланированы.
            </div>
          ) : (
            workspace.upcomingVisits.map((visit) => (
              <div
                key={visit.id}
                className="space-y-3 rounded-xl border border-border bg-white p-4"
                data-testid={`card-regional-visit-${visit.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold">{visit.dealerName}</p>
                    <p className="text-sm text-muted-foreground">{visit.tradePointName}</p>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      {visit.city}, {visit.address}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={statusClass(visit.status)}>
                      {visitStatusLabel(visit.status)}
                    </Badge>
                    <Badge variant="outline" className={priorityClass(visit.priority)}>
                      {priorityLabel(visit.priority)}
                    </Badge>
                  </div>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <p>Время: {visit.plannedTime}</p>
                  <p>{visit.hasDistributionReport ? "Отчет: есть" : "Отчет: нет"}</p>
                  <p>{visit.hasOpenShowcaseGoal ? "Цель по витрине: открыта" : "Цель по витрине: нет"}</p>
                </div>
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href={`/regional-manager/visits/${visit.id}`}>
                    Открыть визит
                    <ArrowRightCircle className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-regional-tasks">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Мои задачи</CardTitle>
          <CardDescription>
            Выполнено: {taskStats.done} · В работе: {taskStats.active} · Просрочено: {taskStats.overdue}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspace.tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Открытых задач нет.
            </div>
          ) : (
            workspace.tasks.map((task) => (
              <div
                key={task.id}
                className="space-y-2 rounded-xl border border-border bg-white p-4"
                data-testid={`card-regional-task-${task.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold">{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.dealerName} · {task.tradePointName}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={statusClass(task.status)}>
                      {task.status === "done" ? "Выполнена" : task.status === "in_progress" ? "В работе" : task.status === "overdue" ? "Просрочена" : "Новая"}
                    </Badge>
                    <Badge variant="outline" className={priorityClass(task.priority)}>
                      {priorityLabel(task.priority)}
                    </Badge>
                  </div>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <p>Тип: {regionalTaskTypeLabel(task.type)}</p>
                  <p>Срок: {formatDate(task.dueDate)}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-regional-at-risk-dealers">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Дилеры в зоне риска</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspace.atRiskDealers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Дилеров в зоне риска нет.
            </div>
          ) : (
            workspace.atRiskDealers.map((dealer) => (
              <div
                key={dealer.dealerId}
                className="space-y-2 rounded-xl border border-border bg-white p-4"
                data-testid={`card-regional-risk-dealer-${dealer.dealerId}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold">{dealer.dealerName}</p>
                    <p className="text-sm text-muted-foreground">{dealer.city}</p>
                  </div>
                  <Badge variant="outline" className={riskClass(dealer.riskLevel)}>
                    {riskLevelLabel(dealer.riskLevel)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">Причина: {dealer.reason}</p>
                <p className="text-sm text-muted-foreground">
                  Последний визит: {dealer.lastVisitDate ? formatDateTime(dealer.lastVisitDate) : "—"}
                </p>
                <p className="text-sm text-muted-foreground">Следующее действие: {dealer.nextAction}</p>
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href={`/dealers/${dealer.dealerId}`}>
                    Открыть карточку дилера
                    <ArrowRightCircle className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-regional-showcase-goals">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">
            Цели по витринам, созданные из визитов РМ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspace.showcaseGoals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Цели по витринам пока не сформированы.
            </div>
          ) : (
            workspace.showcaseGoals.map((goal) => (
              <div
                key={goal.id}
                className="space-y-3 rounded-xl border border-border bg-white p-4"
                data-testid={`card-regional-showcase-goal-${goal.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold">{goal.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {goal.dealerName} · {goal.tradePointName}
                    </p>
                  </div>
                  <Badge variant="outline" className={statusClass(goal.status)}>
                    {showcaseGoalStatusLabel(goal.status)}
                  </Badge>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <p>Срок: {formatDate(goal.dueDate)}</p>
                  <p>Прогресс: {goal.progressPercent}%</p>
                  <p>
                    Визит-источник: {goal.sourceVisitId != null ? `#${goal.sourceVisitId}` : "Не указан"}
                  </p>
                </div>
                <Progress value={goal.progressPercent} className="h-2 bg-muted" />
                <Button asChild variant="outline" className="rounded-xl">
                  <Link href={`/sales/showcase-goals/${goal.id}`}>
                    Открыть цель
                    <Target className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-regional-distribution-focus">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Фокус дистрибуции</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspace.distributionFocus.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Данные фокуса дистрибуции отсутствуют.
            </div>
          ) : (
            workspace.distributionFocus.map((item) => (
              <div key={item.category} className="rounded-xl border border-border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-base font-semibold">{item.category}</p>
                  <Badge variant="outline" className={priorityClass(item.priority)}>
                    {distributionFocusPriorityLabel(item.priority)}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.missingModels} моделей отсутствует · {item.affectedTradePoints} торговые точки
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{item.recommendation}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-regional-recent-activity">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Последняя активность</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {workspace.recentActivity.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Активность пока не зафиксирована.
            </div>
          ) : (
            workspace.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="rounded-xl border border-border bg-white p-3"
              >
                <p className="text-sm font-medium">{regionalActivityTypeLabel(activity.type)}</p>
                <p className="text-sm text-foreground">{activity.title}</p>
                <p className="text-xs text-muted-foreground">{activity.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(activity.createdAt)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Быстрые действия</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Button asChild variant="outline" className="h-11 justify-between rounded-xl bg-white" data-testid="button-regional-open-route">
            <Link href="/regional-manager/route">
              Открыть маршрут
              <RouteIcon className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 justify-between rounded-xl bg-white" data-testid="button-regional-open-dealers">
            <Link href="/dealers">
              Мои дилеры
              <ArrowRightCircle className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 justify-between rounded-xl bg-white" data-testid="button-regional-open-showcase-goals">
            <Link href="/sales/showcase-goals">
              Цели по витринам
              <Target className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 justify-between rounded-xl bg-white" data-testid="button-regional-open-sales-tasks">
            <Link href="/sales/tasks">
              Задачи продаж
              <Clock3 className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 justify-between rounded-xl bg-white" data-testid="button-regional-open-client-base">
            <Link href="/dealers">
              Клиентская база
              <ArrowRightCircle className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 bg-[#f5f5f5] shadow-sm">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <BriefcaseBusiness className="mt-0.5 h-4 w-4 text-primary" />
          <p>
            Вся операционная работа регионального менеджера собрана в одном месте: маршрут, визиты,
            риски дилеров и передача действий в отдел продаж.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
