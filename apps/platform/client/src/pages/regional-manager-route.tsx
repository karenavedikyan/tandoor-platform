import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRightCircle, Building2, CalendarDays, MapPin, Route as RouteIcon } from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { RegionalRoute, RegionalRouteDetail } from "@/lib/api-types";
import { formatDate } from "@/lib/format";
import { routeStatusLabel, visitPriorityLabel, visitPurposeLabel, visitStatusLabel } from "@/lib/labels";

function routeStatusClass(value: string): string {
  if (value === "completed") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (value === "in_progress") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-primary/15 text-foreground border-primary/25";
}

function visitStatusClass(value: string): string {
  if (value === "completed") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (value === "in_progress") return "bg-amber-100 text-amber-800 border-amber-200";
  if (value === "skipped") return "bg-rose-100 text-rose-800 border-rose-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function priorityClass(value: string): string {
  if (value === "high") return "bg-rose-100 text-rose-800 border-rose-200";
  if (value === "medium") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export default function RegionalManagerRoutePage() {
  const routesQuery = useQuery<RegionalRoute[]>({
    queryKey: ["/api/regional-manager/routes"],
  });
  const selectedRouteId = routesQuery.data?.[0]?.id ?? 1;
  const detailQuery = useQuery<RegionalRouteDetail>({
    queryKey: ["/api/regional-manager/routes", String(selectedRouteId)],
    enabled: Boolean(selectedRouteId),
  });

  if (routesQuery.isLoading || detailQuery.isLoading) {
    return (
      <div className="space-y-4" data-testid="page-regional-manager-route">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (routesQuery.isError || detailQuery.isError) {
    return (
      <Alert variant="destructive" data-testid="page-regional-manager-route">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить маршрут РМ</AlertTitle>
        <AlertDescription>
          {routesQuery.error instanceof Error
            ? routesQuery.error.message
            : detailQuery.error instanceof Error
              ? detailQuery.error.message
              : "Проверьте доступность API и повторите попытку."}
        </AlertDescription>
      </Alert>
    );
  }

  const route = detailQuery.data;
  if (!route) {
    return (
      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="page-regional-manager-route">
        <CardHeader>
          <CardTitle>Маршрут не найден</CardTitle>
          <CardDescription>Для регионального менеджера пока нет маршрутов в демо-данных.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-regional-manager-route">
      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Маршрут регионального менеджера</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          План посещений торговых точек, контроль дистрибуции и подготовка целей по витринам.
        </p>
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="card-route-summary">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Сводка маршрута</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Дата маршрута</p>
            <p className="mt-1 font-semibold">{formatDate(route.routeDate)}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Регион</p>
            <p className="mt-1 font-semibold">{route.region}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Визитов запланировано</p>
            <p className="mt-1 text-xl font-semibold">{route.plannedVisitsCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Визитов завершено</p>
            <p className="mt-1 text-xl font-semibold">{route.completedVisitsCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Статус маршрута</p>
            <Badge variant="outline" className={`mt-2 ${routeStatusClass(route.status)}`}>
              {routeStatusLabel(route.status)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="card-regional-manager">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Региональный менеджер</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Сотрудник</p>
            <p className="mt-1 font-semibold">
              {route.regionalManager.firstName} {route.regionalManager.lastName}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Роль</p>
            <p className="mt-1 font-semibold">Региональный менеджер</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Регион</p>
            <p className="mt-1 font-semibold">{route.region}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Сегодня</p>
            <p className="mt-1 font-semibold">{route.visits.length} визитов</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Фокус</p>
            <p className="mt-1 font-semibold">Дистрибуция и витрины</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="list-route-visits">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Визиты маршрута</CardTitle>
          <CardDescription>Каждый визит открывает карточку ТТ и отчет дистрибуции.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {route.visits.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              В маршруте пока нет визитов.
            </div>
          ) : (
            route.visits.map((visit) => (
              <div
                key={visit.id}
                className="rounded-xl border border-border bg-white p-4"
                data-testid={`card-route-visit-${visit.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {visit.plannedTime}
                    </p>
                    <p className="text-base font-semibold text-foreground">{visit.dealer.name}</p>
                    <p className="text-sm text-muted-foreground">{visit.tradePoint.name}</p>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      {visit.tradePoint.city}, {visit.tradePoint.address}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={visitStatusClass(visit.visitStatus)}>
                      {visitStatusLabel(visit.visitStatus)}
                    </Badge>
                    <Badge variant="outline" className={priorityClass(visit.priority)}>
                      {visitPriorityLabel(visit.priority)}
                    </Badge>
                    <Badge variant="outline" className="bg-primary/10 text-foreground border-primary/25">
                      {visitPurposeLabel(visit.visitPurpose)}
                    </Badge>
                  </div>
                </div>
                <Button
                  asChild
                  className="mt-4 h-10 rounded-xl px-4 text-sm font-semibold"
                  data-testid={`button-open-visit-${visit.id}`}
                >
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

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-route-sales-link">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Как маршрут связан с продажами</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed text-muted-foreground">
          РМ фиксирует фактическую дистрибуцию и состояние витрины в торговой точке. После отправки отчета
          руководитель и менеджер продаж получают основание для постановки целей: какие модели выставить, где
          обновить POSM, где усилить ассортимент.
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Быстрые действия</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Button asChild variant="outline" className="h-11 justify-between rounded-xl bg-white" data-testid="button-open-dealers">
            <Link href="/dealers">
              Открыть клиентскую базу
              <Building2 className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 justify-between rounded-xl bg-white" data-testid="button-open-sales-department">
            <Link href="/sales-department">
              Открыть ЛК отдела продаж
              <RouteIcon className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 justify-between rounded-xl bg-white" data-testid="button-open-orders">
            <Link href="/orders">
              Открыть заказы
              <ArrowRightCircle className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
