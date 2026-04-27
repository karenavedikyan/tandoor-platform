import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRightCircle, BarChart3, Clock3, Users } from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { SalesLeadershipDashboard } from "@/lib/api-types";
import { formatDate } from "@/lib/format";
import {
  leadershipRoleLabel,
  overdueItemTypeLabel,
  priorityLabel,
  riskLevelLabel,
  severityLabel,
  workloadStatusLabel,
} from "@/lib/labels";

function workloadStatusClass(status: string): string {
  if (status === "overloaded") {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  if (status === "high") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

function riskLevelClass(level: string): string {
  if (level === "critical") {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  if (level === "high") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-sky-100 text-sky-800 border-sky-200";
}

function severityClass(level: string): string {
  if (level === "critical") {
    return "bg-rose-100 text-rose-800 border-rose-200";
  }
  if (level === "high") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function pipelineToneClass(colorTone: string): string {
  if (colorTone === "lime") {
    return "bg-primary/15 text-foreground border-primary/30";
  }
  if (colorTone === "amber") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  if (colorTone === "sky") {
    return "bg-sky-100 text-sky-800 border-sky-200";
  }
  if (colorTone === "emerald") {
    return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  return "bg-rose-100 text-rose-800 border-rose-200";
}

export default function SalesLeadershipDashboardPage() {
  const dashboardQuery = useQuery<SalesLeadershipDashboard>({
    queryKey: ["/api/sales/leadership-dashboard"],
  });

  if (dashboardQuery.isLoading) {
    return (
      <div className="space-y-4" data-testid="page-sales-leadership">
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <Alert variant="destructive" data-testid="page-sales-leadership">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить панель руководителя продаж</AlertTitle>
        <AlertDescription>
          {dashboardQuery.error instanceof Error
            ? dashboardQuery.error.message
            : "Ошибка загрузки управленческой сводки"}
        </AlertDescription>
      </Alert>
    );
  }

  const dashboard = dashboardQuery.data;
  if (!dashboard) {
    return (
      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="page-sales-leadership">
        <CardHeader>
          <CardTitle>Панель пока недоступна</CardTitle>
          <CardDescription>
            В демо-данных нет сведений для построения управленческой панели.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const roleCardTestId: Record<string, string> = {
    sales_head: "card-leadership-role-sales-head",
    team_head: "card-leadership-role-team-head",
    regional_head: "card-leadership-role-regional-head",
  };

  return (
    <div className="space-y-6" data-testid="page-sales-leadership">
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Панель руководителя продаж</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Контроль дилеров, маршрутов региональных менеджеров, целей по витринам и задач отдела
          продаж.
        </p>
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="card-leadership-kpis">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Ключевые показатели</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="rounded-xl border border-border bg-white p-3" data-testid="kpi-leadership-dealers">
            <p className="text-xs text-muted-foreground">Дилеры</p>
            <p className="mt-1 text-xl font-semibold">{dashboard.kpis.dealersTotal}</p>
          </div>
          <div
            className="rounded-xl border border-border bg-white p-3"
            data-testid="kpi-leadership-trade-points"
          >
            <p className="text-xs text-muted-foreground">Торговые точки</p>
            <p className="mt-1 text-xl font-semibold">{dashboard.kpis.tradePointsTotal}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3" data-testid="kpi-leadership-visits">
            <p className="text-xs text-muted-foreground">Визиты РМ</p>
            <p className="mt-1 text-xl font-semibold">
              {dashboard.kpis.visitsCompleted}/{dashboard.kpis.visitsPlanned}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3" data-testid="kpi-leadership-reports">
            <p className="text-xs text-muted-foreground">Отчеты дистрибуции</p>
            <p className="mt-1 text-xl font-semibold">{dashboard.kpis.distributionReportsSubmitted}</p>
          </div>
          <div
            className="rounded-xl border border-border bg-white p-3"
            data-testid="kpi-leadership-showcase-goals"
          >
            <p className="text-xs text-muted-foreground">Цели по витринам</p>
            <p className="mt-1 text-xl font-semibold">{dashboard.kpis.showcaseGoalsTotal}</p>
          </div>
          <div
            className="rounded-xl border border-border bg-white p-3"
            data-testid="kpi-leadership-completed-goals"
          >
            <p className="text-xs text-muted-foreground">Выполнено целей</p>
            <p className="mt-1 text-xl font-semibold">{dashboard.kpis.showcaseGoalsCompleted}</p>
          </div>
          <div
            className="rounded-xl border border-border bg-white p-3"
            data-testid="kpi-leadership-sales-tasks"
          >
            <p className="text-xs text-muted-foreground">Задачи продаж</p>
            <p className="mt-1 text-xl font-semibold">{dashboard.kpis.salesTasksTotal}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3" data-testid="kpi-leadership-overdue">
            <p className="text-xs text-muted-foreground">Просрочено</p>
            <p className="mt-1 text-xl font-semibold">{dashboard.kpis.salesTasksOverdue}</p>
          </div>
          <div
            className="rounded-xl border border-border bg-white p-3"
            data-testid="kpi-leadership-risk-dealers"
          >
            <p className="text-xs text-muted-foreground">Дилеры в зоне риска</p>
            <p className="mt-1 text-xl font-semibold">{dashboard.kpis.atRiskDealersCount}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-leadership-roles">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Роли управления</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {dashboard.roleSummaries.map((summary) => (
            <div
              key={summary.role}
              className="space-y-3 rounded-xl border border-border bg-white p-4"
              data-testid={roleCardTestId[summary.role] ?? `card-leadership-role-${summary.role}`}
            >
              <div>
                <p className="text-xs text-muted-foreground">{leadershipRoleLabel(summary.role)}</p>
                <p className="mt-1 text-base font-semibold">{summary.ownerName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{summary.focus}</p>
              </div>
              <ul className="space-y-1 text-sm">
                {summary.mainMetrics.map((metric) => (
                  <li key={metric} className="rounded-lg border border-border/70 bg-muted/25 px-2.5 py-1.5">
                    {metric}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="w-full justify-between rounded-xl">
                <Link href={summary.actionHref}>
                  {summary.actionLabel}
                  <ArrowRightCircle className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card
        className="rounded-2xl border-border/80 shadow-sm"
        data-testid="section-showcase-goal-pipeline"
      >
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Воронка целей по витринам</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {dashboard.showcaseGoalPipeline.map((item) => (
              <div
                key={item.status}
                className={`rounded-xl border px-3 py-4 ${pipelineToneClass(item.colorTone)}`}
                data-testid={`card-goal-pipeline-${item.status.replace("_", "-")}`}
              >
                <p className="text-xs">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold">{item.count}</p>
              </div>
            ))}
          </div>
          <Button asChild className="rounded-xl" data-testid="button-open-showcase-goals">
            <Link href="/sales/showcase-goals">
              Открыть цели по витринам
              <ArrowRightCircle className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-regional-activity">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">
            Активность региональных менеджеров
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4" data-testid="card-regional-activity">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-xs text-muted-foreground">Маршрутов сегодня</p>
              <p className="mt-1 text-xl font-semibold">{dashboard.regionalActivity.routesToday}</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-xs text-muted-foreground">Визитов сегодня</p>
              <p className="mt-1 text-xl font-semibold">{dashboard.regionalActivity.visitsToday}</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-xs text-muted-foreground">Завершено визитов</p>
              <p className="mt-1 text-xl font-semibold">{dashboard.regionalActivity.completedVisits}</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-xs text-muted-foreground">Визитов в работе</p>
              <p className="mt-1 text-xl font-semibold">{dashboard.regionalActivity.inProgressVisits}</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-xs text-muted-foreground">Отчетов создано</p>
              <p className="mt-1 text-xl font-semibold">{dashboard.regionalActivity.reportsCreated}</p>
            </div>
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-xs text-muted-foreground">Отчетов отправлено</p>
              <p className="mt-1 text-xl font-semibold">{dashboard.regionalActivity.reportsSubmitted}</p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Следующий визит</p>
            <p className="mt-1 text-sm font-semibold">{dashboard.regionalActivity.nextVisitTitle}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Время: {dashboard.regionalActivity.nextVisitTime}
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-xl" data-testid="button-open-regional-route">
            <Link href={dashboard.regionalActivity.linkToRoute}>
              Открыть маршрут РМ
              <ArrowRightCircle className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-team-workload">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Нагрузка команды</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dashboard.teamWorkload.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Нет данных по нагрузке команды.
            </div>
          ) : (
            dashboard.teamWorkload.map((member) => (
              <div
                key={member.userId}
                className="space-y-3 rounded-xl border border-border bg-white p-4"
                data-testid={`card-team-workload-${member.userId}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {leadershipRoleLabel(member.role)} · {member.team}
                    </p>
                  </div>
                  <Badge variant="outline" className={workloadStatusClass(member.workloadStatus)}>
                    {workloadStatusLabel(member.workloadStatus)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="rounded-lg border border-border/70 bg-muted/20 p-2">
                    Цели: <span className="font-semibold">{member.activeGoalsCount}</span>
                  </p>
                  <p className="rounded-lg border border-border/70 bg-muted/20 p-2">
                    Задачи: <span className="font-semibold">{member.activeTasksCount}</span>
                  </p>
                  <p className="rounded-lg border border-border/70 bg-muted/20 p-2">
                    Просрочки: <span className="font-semibold">{member.overdueTasksCount}</span>
                  </p>
                  <p className="rounded-lg border border-border/70 bg-muted/20 p-2">
                    Визиты/отчеты:{" "}
                    <span className="font-semibold">
                      {member.visitsCount}/{member.reportsCount}
                    </span>
                  </p>
                </div>
                <p className="rounded-lg border border-border/70 bg-muted/20 p-2 text-sm text-muted-foreground">
                  Следующий фокус: {member.nextFocus}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-at-risk-dealers">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Дилеры в зоне риска</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard.atRiskDealers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Сейчас нет дилеров, требующих оперативного внимания.
            </div>
          ) : (
            dashboard.atRiskDealers.map((dealer) => (
              <div
                key={`${dealer.dealerId}-${dealer.tradePointId ?? "main"}`}
                className="space-y-3 rounded-xl border border-border bg-white p-4"
                data-testid={`card-risk-dealer-${dealer.dealerId}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold">{dealer.dealerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {dealer.tradePointName ? `${dealer.tradePointName} · ` : ""}
                      {dealer.city}
                    </p>
                  </div>
                  <Badge variant="outline" className={riskLevelClass(dealer.riskLevel)}>
                    {riskLevelLabel(dealer.riskLevel)}
                  </Badge>
                </div>
                <div className="space-y-1.5 text-sm">
                  <p>
                    <span className="text-muted-foreground">Причина:</span> {dealer.riskReason}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Ответственный:</span>{" "}
                    {dealer.responsibleName}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Последнее действие:</span>{" "}
                    {dealer.lastAction}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Следующий шаг:</span> {dealer.nextAction}
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-xl"
                  data-testid={`button-open-risk-dealer-${dealer.dealerId}`}
                >
                  <Link href={dealer.actionHref}>
                    Открыть
                    <ArrowRightCircle className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-overdue-items">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Просрочки и контроль</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard.overdueItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Просроченных элементов не найдено.
            </div>
          ) : (
            dashboard.overdueItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-white p-4"
                data-testid={`card-overdue-item-${item.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">{overdueItemTypeLabel(item.type)}</p>
                    <p className="text-base font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">Ответственный: {item.ownerName}</p>
                  </div>
                  <Badge variant="outline" className={severityClass(item.severity)}>
                    {severityLabel(item.severity)}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock3 className="h-4 w-4" />
                    Срок: {formatDate(item.dueDate)}
                  </p>
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-xl"
                    data-testid={`button-open-overdue-item-${item.id}`}
                  >
                    <Link href={item.href}>
                      Открыть
                      <ArrowRightCircle className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card
        className="rounded-2xl border-border/80 shadow-sm"
        data-testid="section-leadership-next-actions"
      >
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">
            Следующие управленческие действия
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {dashboard.nextActions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Нет предложенных действий.
            </div>
          ) : (
            dashboard.nextActions.map((action, index) => (
              <div
                key={`${action.title}-${index}`}
                className="space-y-3 rounded-xl border border-border bg-white p-4"
                data-testid={`card-next-action-${index}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold">{action.title}</p>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                  <Badge variant="outline" className="bg-primary/15 text-foreground border-primary/30">
                    {priorityLabel(action.priority)}
                  </Badge>
                </div>
                <Button asChild className="w-full rounded-xl" data-testid={`button-open-next-action-${index}`}>
                  <Link href={action.href}>
                    Перейти к действию
                    <ArrowRightCircle className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 bg-[#f5f5f5] shadow-sm">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <BarChart3 className="mt-0.5 h-4 w-4 text-primary" />
          <p>
            Первый управленческий контур закрыт: клиентская база, маршруты РМ, визиты, отчеты
            дистрибуции, цели по витринам и задачи отдела продаж теперь собраны в единую панель
            контроля.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
