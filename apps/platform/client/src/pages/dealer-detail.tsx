import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { AlertCircle, ChevronLeft, MapPin, Route, UserCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DealerDetail } from "@/lib/api-types";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  dealerStatusLabel,
  dealerTypeLabel,
  interactionTypeLabel,
  potentialLevelLabel,
  roleContextLabel,
  storeFormatLabel,
  taskPriorityLabel,
  taskSourceLabel,
  taskStatusLabel,
  taskTypeLabel,
  tradePointStatusLabel,
} from "@/lib/labels";

function nullable(value: string | null | undefined, fallback = "—"): string {
  return value ?? fallback;
}

function detailStyle(kind: "status" | "potential" | "taskStatus" | "priority", value: string) {
  if (kind === "status") {
    if (value === "active") return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (value === "inactive") return "bg-slate-100 text-slate-700 border-slate-200";
  }
  if (kind === "potential") {
    if (value === "high") return "bg-primary/15 text-foreground border-primary/25";
    if (value === "medium") return "bg-amber-100 text-amber-800 border-amber-200";
    if (value === "low") return "bg-slate-100 text-slate-700 border-slate-200";
  }
  if (kind === "taskStatus") {
    if (value === "new") return "bg-primary/15 text-foreground border-primary/25";
    if (value === "in_progress") return "bg-amber-100 text-amber-800 border-amber-200";
    if (value === "done") return "bg-emerald-100 text-emerald-800 border-emerald-200";
    if (value === "rejected") return "bg-rose-100 text-rose-800 border-rose-200";
  }
  if (kind === "priority") {
    if (value === "high") return "bg-rose-100 text-rose-800 border-rose-200";
    if (value === "medium") return "bg-amber-100 text-amber-800 border-amber-200";
    if (value === "low") return "bg-slate-100 text-slate-700 border-slate-200";
  }
  return "bg-muted text-muted-foreground border-border";
}

export default function DealerDetailPage() {
  const [match, params] = useRoute("/dealers/:id");
  const dealerId = match ? Number.parseInt(params.id, 10) : Number.NaN;

  const dealerQuery = useQuery<DealerDetail>({
    queryKey: ["/api/dealers", String(dealerId)],
    enabled: Number.isFinite(dealerId),
  });

  if (!Number.isFinite(dealerId)) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Некорректный ID дилера</AlertTitle>
        <AlertDescription>Запрошенный идентификатор дилера неверный.</AlertDescription>
      </Alert>
    );
  }

  if (dealerQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    );
  }

  if (dealerQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить карточку дилера</AlertTitle>
        <AlertDescription>
          {dealerQuery.error instanceof Error ? dealerQuery.error.message : "Неожиданная ошибка"}
        </AlertDescription>
      </Alert>
    );
  }

  const data = dealerQuery.data;
  if (!data) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Дилер не найден</AlertTitle>
        <AlertDescription>Такого дилера нет в текущем наборе данных.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-dealer-detail">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="outline" size="sm" className="mb-3 rounded-xl">
            <Link href="/dealers">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Назад к клиентской базе
            </Link>
          </Button>
          <h1 className="text-2xl font-bold uppercase tracking-[0.02em] text-foreground">Карточка дилера</h1>
          <p className="text-sm text-muted-foreground">Единый клиентский контекст продаж и регионального блока.</p>
        </div>
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>{data.dealer.name}</CardTitle>
          <CardDescription>{data.dealer.segment}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Тип дилера</p>
            <p className="mt-1 font-medium">{dealerTypeLabel(data.dealer.dealerType)}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Регион / город</p>
            <p className="mt-1 font-medium">
              {nullable(data.dealer.region)}, {nullable(data.dealer.city)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Статус / потенциал</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" className={detailStyle("status", data.dealer.status)}>
                {dealerStatusLabel(data.dealer.status)}
              </Badge>
              <Badge
                variant="outline"
                className={detailStyle("potential", data.dealer.potentialLevel ?? "medium")}
              >
                {potentialLevelLabel(data.dealer.potentialLevel ?? "medium")}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-dealer-responsibles">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Ответственные</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Менеджер продаж</p>
            <p className="mt-1 font-medium">{data.dealer.salesManagerName}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Региональный менеджер</p>
            <p className="mt-1 font-medium">{data.dealer.regionalManagerName}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Комментарий</p>
            <p className="mt-1 text-sm text-foreground">{data.dealer.comment ?? "Без комментариев"}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-dealer-trade-points">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Торговые точки</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {data.tradePoints.map((point) => (
            <div
              key={point.id}
              className="rounded-xl border border-border bg-white p-4"
              data-testid={`card-trade-point-${point.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{point.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {point.city}, {point.address}
                  </p>
                </div>
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-3 grid gap-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Формат:</span> {storeFormatLabel(point.storeFormat)}
                </p>
                <p>
                  <span className="text-muted-foreground">Площадь:</span> {point.areaSqm ?? "—"} м²
                </p>
                <p>
                  <span className="text-muted-foreground">Профиль:</span> {point.assortmentProfile}
                </p>
                <Badge variant="outline" className={detailStyle("status", point.status)}>
                  {tradePointStatusLabel(point.status)}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-dealer-tasks">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Задачи по клиенту</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.tasks.map((task) => (
            <div
              key={task.id}
              className="rounded-xl border border-border bg-white p-4"
              data-testid={`card-dealer-task-${task.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{task.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                </div>
                <Route className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Назначено:</span> {task.assignedToUserName}
                </p>
                <p>
                  <span className="text-muted-foreground">Создал:</span> {task.createdByUserName}
                </p>
                <p>
                  <span className="text-muted-foreground">Срок:</span> {formatDate(task.dueDate)}
                </p>
                <p>
                  <span className="text-muted-foreground">Источник:</span> {taskSourceLabel(task.source)}
                </p>
                <p>
                  <span className="text-muted-foreground">Тип:</span> {taskTypeLabel(task.type)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className={detailStyle("taskStatus", task.status)}>
                  {taskStatusLabel(task.status)}
                </Badge>
                <Badge variant="outline" className={detailStyle("priority", task.priority)}>
                  Приоритет: {taskPriorityLabel(task.priority)}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm" data-testid="section-dealer-interactions">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">История взаимодействий</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.interactions.map((interaction) => (
            <div
              key={interaction.id}
              className="rounded-xl border border-border bg-white p-4"
              data-testid={`card-dealer-interaction-${interaction.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {roleContextLabel(interaction.roleContext)} · {interactionTypeLabel(interaction.type)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{interaction.summary}</p>
                </div>
                <UserCircle2 className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {interaction.userName} · {formatDateTime(interaction.createdAt)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Заказы</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recentOrders.length ? (
            data.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-xl border border-border bg-white p-3 text-sm">
                <p className="font-medium">{order.orderNumber}</p>
                <p className="text-muted-foreground">
                  {dealerStatusLabel(order.status)} · {formatDate(order.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Заказы по дилеру пока не найдены</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Рекламации</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recentClaims.length ? (
            data.recentClaims.map((claim) => (
              <div key={claim.id} className="flex items-center justify-between rounded-xl border border-border bg-white p-3 text-sm">
                <p className="font-medium">{claim.claimNumber}</p>
                <p className="text-muted-foreground">
                  {taskStatusLabel(claim.status)} · {formatDate(claim.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Рекламации по дилеру пока не найдены</p>
          )}
        </CardContent>
      </Card>

      <Card
        className="rounded-2xl border-border/80 border-dashed bg-muted/20 shadow-sm"
        data-testid="section-dealer-distribution-summary"
      >
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-wide">Дистрибуция и витрины</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Здесь будет отображаться покрытие моделей Tandoor по торговым точкам дилера после запуска отчетов
          дистрибуции.
        </CardContent>
      </Card>
    </div>
  );
}
