import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowRightCircle,
  Bell,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Cog,
  FileText,
  LayoutDashboard,
  MapPin,
  ShieldAlert,
  Users,
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
  regionalOperationalStatusLabel,
  regionalTaskTypeLabel,
  riskLevelLabel,
  routeStatusLabel,
  showcaseGoalStatusLabel,
  visitStatusLabel,
} from "@/lib/labels";

type RegionObjectFilter = "all" | "problem" | "normal" | "overdue" | "today";

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

function operationalStatusBadgeClass(status: string): string {
  if (status === "critical") return "border-rose-200 bg-rose-100 text-rose-800";
  if (status === "attention") return "border-amber-200 bg-amber-100 text-amber-800";
  if (status === "in_progress") return "border-sky-200 bg-sky-100 text-sky-800";
  if (status === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-emerald-200 bg-emerald-100 text-emerald-800";
}

function mainNowCardClass(status: string): string {
  if (status === "critical") return "border-rose-200 bg-rose-50";
  if (status === "attention") return "border-amber-200 bg-amber-50";
  if (status === "in_progress") return "border-sky-200 bg-sky-50";
  if (status === "completed") return "border-emerald-200 bg-emerald-50";
  return "border-border bg-white";
}

function systemSectionIcon(sectionId: string) {
  if (sectionId === "objects") return Building2;
  if (sectionId === "employees") return Users;
  if (sectionId === "tasks") return ClipboardList;
  if (sectionId === "checks") return ClipboardCheck;
  if (sectionId === "reports") return FileText;
  if (sectionId === "requests") return ShieldAlert;
  if (sectionId === "kpi") return LayoutDashboard;
  if (sectionId === "documents") return FileText;
  if (sectionId === "notifications") return Bell;
  return Cog;
}

function systemSectionCardTestId(sectionId: string): string {
  if (sectionId === "objects") return "card-regional-section-objects";
  if (sectionId === "employees") return "card-regional-section-employees";
  if (sectionId === "tasks") return "card-regional-section-tasks";
  if (sectionId === "checks") return "card-regional-section-checks";
  if (sectionId === "reports") return "card-regional-section-reports";
  if (sectionId === "requests") return "card-regional-section-requests";
  if (sectionId === "kpi") return "card-regional-section-kpi";
  if (sectionId === "documents") return "card-regional-section-documents";
  if (sectionId === "notifications") return "card-regional-section-notifications";
  return "card-regional-section-settings";
}

export default function RegionalManagerWorkspacePage() {
  const workspaceQuery = useQuery<RegionalManagerWorkspace>({
    queryKey: ["/api/regional-manager/workspace"],
  });
  const [objectsFilter, setObjectsFilter] = useState<RegionObjectFilter>("all");

  const tasks = workspaceQuery.data?.tasks;
  const regionObjects = workspaceQuery.data?.regionObjects ?? [];
  const mainNow = workspaceQuery.data?.mainNow ?? [];
  const systemSections = workspaceQuery.data?.systemSections ?? [];
  const notificationsSummary = workspaceQuery.data?.notificationsSummary;
  const taskStats = useMemo(
    () => ({
      done: tasks?.filter((task) => task.status === "done").length ?? 0,
      active: tasks?.filter((task) => task.status === "in_progress").length ?? 0,
      overdue: tasks?.filter((task) => task.status === "overdue").length ?? 0,
    }),
    [tasks],
  );

  const filteredRegionObjects = useMemo(
    () =>
      regionObjects.filter((item) => {
        if (objectsFilter === "problem") {
          return item.isProblem;
        }
        if (objectsFilter === "normal") {
          return item.status === "normal" || item.status === "completed";
        }
        if (objectsFilter === "overdue") {
          return item.isOverdue;
        }
        if (objectsFilter === "today") {
          return item.isToday;
        }
        return true;
      }),
    [objectsFilter, regionObjects],
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
  const mainNowById = new Map(mainNow.map((item) => [item.id, item]));
  const mainNowCards = [
    { id: "attention", testId: "card-main-now-attention" },
    { id: "overdue", testId: "card-main-now-overdue" },
    { id: "risk_objects", testId: "card-main-now-risk-objects" },
    { id: "today_tasks", testId: "card-main-now-today-tasks" },
    { id: "missing_reports", testId: "card-main-now-missing-reports" },
  ] as const;

  return (
    <div className="space-y-6 bg-slate-50/70" data-testid="page-regional-manager-workspace">
      <Card className="rounded-2xl border-border/80 bg-card shadow-sm" data-testid="section-regional-hero">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Центр управления регионом</h1>
              <p className="text-sm text-muted-foreground">
                Операционный кабинет регионального менеджера
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border bg-white px-3 py-1">
                  {workspace.manager.name}
                </span>
                <span className="rounded-full border border-border bg-white px-3 py-1">
                  Регион: {workspace.manager.region}
                </span>
                <span className="rounded-full border border-border bg-white px-3 py-1">
                  Период: {workspace.period.label}
                </span>
                <span className="rounded-full border border-border bg-white px-3 py-1">
                  {workspace.manager.teamName}
                </span>
              </div>
            </div>
            <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2 lg:grid-cols-3">
              <Button asChild className="h-10 rounded-xl" data-testid="button-regional-hero-open-route">
                <Link href="/regional-manager/route">
                  Маршрут на сегодня
                  <RouteIcon className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-xl bg-white"
                data-testid="button-regional-hero-start-next-visit"
              >
                <Link href={nextVisitHref}>
                  Начать следующий визит
                  <ArrowRightCircle className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-xl bg-white sm:col-span-2 lg:col-span-1"
                data-testid="button-regional-hero-open-tasks"
              >
                <Link href="/sales/tasks">
                  Открыть задачи
                  <Clock3 className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-regional-main-now">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Главное сейчас</CardTitle>
          <CardDescription>
            Сигналы, которые требуют быстрых управленческих действий сегодня.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {mainNowCards.map((meta) => {
            const item = mainNowById.get(meta.id);
            if (!item) {
              return (
                <div key={meta.id} className="rounded-xl border border-dashed border-border bg-white p-4">
                  <p className="text-sm text-muted-foreground">Показатель недоступен</p>
                </div>
              );
            }
            return (
              <div
                key={item.id}
                className={`space-y-3 rounded-xl border p-4 ${mainNowCardClass(item.status)}`}
                data-testid={meta.testId}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <Badge variant="outline" className={operationalStatusBadgeClass(item.status)}>
                    {regionalOperationalStatusLabel(item.status)}
                  </Badge>
                </div>
                <p className="text-3xl font-bold text-foreground">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
                <Button asChild size="sm" variant="outline" className="h-9 rounded-lg bg-white">
                  <Link href={item.actionHref}>
                    {item.actionLabel}
                    <ArrowRightCircle className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-regional-objects">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Объекты региона</CardTitle>
          <CardDescription>
            Быстрый обзор точек и дилеров по операционному статусу.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <Button
              type="button"
              variant={objectsFilter === "all" ? "default" : "outline"}
              className="h-9 rounded-full whitespace-nowrap"
              onClick={() => setObjectsFilter("all")}
              data-testid="filter-regional-objects-all"
            >
              Все
            </Button>
            <Button
              type="button"
              variant={objectsFilter === "problem" ? "default" : "outline"}
              className="h-9 rounded-full whitespace-nowrap"
              onClick={() => setObjectsFilter("problem")}
              data-testid="filter-regional-objects-problem"
            >
              Проблемные
            </Button>
            <Button
              type="button"
              variant={objectsFilter === "normal" ? "default" : "outline"}
              className="h-9 rounded-full whitespace-nowrap"
              onClick={() => setObjectsFilter("normal")}
              data-testid="filter-regional-objects-normal"
            >
              В норме
            </Button>
            <Button
              type="button"
              variant={objectsFilter === "overdue" ? "default" : "outline"}
              className="h-9 rounded-full whitespace-nowrap"
              onClick={() => setObjectsFilter("overdue")}
              data-testid="filter-regional-objects-overdue"
            >
              Просроченные
            </Button>
            <Button
              type="button"
              variant={objectsFilter === "today" ? "default" : "outline"}
              className="h-9 rounded-full whitespace-nowrap"
              onClick={() => setObjectsFilter("today")}
              data-testid="filter-regional-objects-today"
            >
              Сегодня
            </Button>
          </div>
          {filteredRegionObjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Для выбранного фильтра объекты не найдены.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredRegionObjects.map((item) => (
                <div
                  key={item.id}
                  className="space-y-3 rounded-xl border border-border bg-white p-4"
                  data-testid={`card-regional-object-${item.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-semibold">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.city}</p>
                      <p className="text-xs text-muted-foreground">{item.address}</p>
                    </div>
                    <Badge variant="outline" className={operationalStatusBadgeClass(item.status)}>
                      {regionalOperationalStatusLabel(item.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    Последняя активность:{" "}
                    {item.lastActivityAt ? formatDateTime(item.lastActivityAt) : "не зафиксирована"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ответственный менеджер: {item.salesManagerName}
                  </p>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-lg bg-white"
                    data-testid={`button-open-regional-object-${item.id}`}
                  >
                    <Link href={item.href}>
                      Открыть
                      <ArrowRightCircle className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-regional-system-sections">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Разделы системы</CardTitle>
          <CardDescription>
            Все ключевые функции кабинета в одном месте.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {systemSections.map((section) => {
            const Icon = systemSectionIcon(section.id);
            return (
              <div
                key={section.id}
                className={`space-y-3 rounded-xl border p-4 ${
                  section.isFuture ? "border-dashed bg-slate-50/80" : "border-border bg-white"
                }`}
                data-testid={systemSectionCardTestId(section.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold">{section.title}</p>
                  </div>
                  <Badge variant="outline" className={operationalStatusBadgeClass(section.status)}>
                    {regionalOperationalStatusLabel(section.status)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{section.description}</p>
                <p className="text-2xl font-semibold text-foreground">{section.count}</p>
                {section.href ? (
                  <Button asChild size="sm" variant="outline" className="h-9 rounded-lg bg-white">
                    <Link href={section.href}>
                      Перейти
                      <ArrowRightCircle className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    Будет добавлено следующим блоком
                  </div>
                )}
              </div>
            );
          })}
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
          <CardTitle className="text-lg uppercase tracking-wide">Последние события</CardTitle>
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

      <Card className="rounded-2xl border-border/80 bg-white shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span>
              Сигналы: критичные {notificationsSummary?.critical ?? 0}, внимание{" "}
              {notificationsSummary?.attention ?? 0}, в работе {notificationsSummary?.inProgress ?? 0}
            </span>
          </div>
          <span>Период: {formatDate(workspace.period.dateFrom)} — {formatDate(workspace.period.dateTo)}</span>
        </CardContent>
      </Card>
    </div>
  );
}
