import { useMemo } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { cn } from "@/lib/utils";
import {
  getFocusProducts,
  getMyDealers,
  getSalesManagerMatrixTasks,
  getTradePointsNeedingAttention,
  getWorkspaceKpis,
  isMatrixTaskDueToday,
  isMatrixTaskOverdue,
  matrixTaskContextHref,
} from "@/lib/sales-manager-workspace-data";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import {
  MATRIX_TASK_PRIORITY_LABEL,
  MATRIX_TASK_STATUS_LABEL,
  type MatrixTaskWithContext,
} from "@/lib/trade-point-task-data";
import {
  getOrdersForSalesManager,
  ORDER_FLAG_TONE,
  ORDER_PAYMENT_TONE,
  ORDER_SHIPMENT_TONE,
  ORDER_STATUS_TONE,
} from "@/lib/order-data";
import { SALES_MANAGER_PUBLIC_NAME } from "@/lib/sales-manager-workspace-data";

function statusBadgeClass(status: DealerRow["status"]) {
  if (status === "требует внимания") return "border-amber-300 bg-amber-50 text-amber-950";
  if (status === "потенциальный") return "border-sky-200 bg-sky-50 text-sky-950";
  if (status === "приостановлен") return "border-neutral-200 bg-muted text-muted-foreground";
  return "border-emerald-200 bg-emerald-50 text-emerald-950";
}

function categoryBadgeClass(cat: DealerRow["category"]) {
  if (cat === "TOP") return "border-primary/40 bg-primary/15 text-foreground font-semibold";
  return "border-border bg-muted/60 text-foreground";
}

function matrixStatusBadgeClass(t: MatrixTaskWithContext) {
  if (t.status === "overdue") return "border-red-200 bg-red-50 text-red-900";
  if (t.status === "in_progress") return "border-amber-200 bg-amber-50 text-amber-950";
  if (t.status === "new") return "border-primary/40 bg-primary/10 text-primary";
  return "border-emerald-200 bg-emerald-50 text-emerald-900";
}

function priorityBadgeClass(p: MatrixTaskWithContext["priority"]) {
  if (p === "high") return "border-red-200 bg-red-50 text-red-900";
  if (p === "medium") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted text-muted-foreground";
}

export default function SalesManagerWorkspace() {
  const kpis = useMemo(() => getWorkspaceKpis(), []);
  const myDealers = useMemo(() => getMyDealers(), []);
  const tasks = useMemo(() => getSalesManagerMatrixTasks().slice(0, 12), []);
  const focusProducts = useMemo(() => getFocusProducts(8), []);
  const attentionPoints = useMemo(() => getTradePointsNeedingAttention(8), []);
  const managerOrders = useMemo(() => getOrdersForSalesManager(SALES_MANAGER_PUBLIC_NAME, 8), []);

  return (
    <div className="space-y-8 pb-24 sm:space-y-10" data-testid="page-sales-manager-workspace">
      <section
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8"
        data-testid="section-sales-manager-hero"
      >
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative space-y-4 pl-3 sm:pl-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Кабинет менеджера</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Рабочий центр по клиентам, задачам и продажам: приоритеты, переходы в карточки и каталог.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Клиентов в зоне", value: String(kpis.clients) },
              { label: "Открытых задач", value: String(kpis.tasksOpen) },
              { label: "Точек с вниманием", value: String(kpis.tradePointsIssues) },
              { label: "Товаров в фокусе", value: String(kpis.focusProducts) },
            ].map((k) => (
              <Card key={k.label} className="rounded-xl border border-border/80 bg-background/80 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{k.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="min-h-10 font-semibold" data-testid="button-sales-manager-open-dealers">
              <Link href="/dealer-base">К клиентской базе</Link>
            </Button>
            <Button asChild variant="secondary" className="min-h-10 font-semibold" data-testid="button-sales-manager-open-tasks">
              <Link href="/tasks">К задачам</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-10 border-border bg-card font-semibold" data-testid="button-sales-manager-open-catalog">
              <Link href="/catalog">К каталогу</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4" data-testid="section-sales-manager-main-now">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Главное сегодня</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/tasks"
            data-testid="card-sales-main-now-overdue"
            className="block rounded-2xl border border-red-200/80 bg-gradient-to-b from-red-50/80 to-card p-4 shadow-md no-underline transition-shadow hover:shadow-lg sm:p-5"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-red-800">Просрочено</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-red-900">{kpis.overdue}</p>
            <p className="mt-2 text-sm text-red-900/90">Задачи с истёкшим сроком — открыть список</p>
          </Link>
          <Link
            href="/tasks"
            data-testid="card-sales-main-now-today"
            className="block rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50/70 to-card p-4 shadow-md no-underline transition-shadow hover:shadow-lg sm:p-5"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-amber-900">На сегодня</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-amber-950">{kpis.today}</p>
            <p className="mt-2 text-sm text-amber-950/90">Срок сегодня — не откладывать</p>
          </Link>
          <Link
            href="/dealer-base"
            data-testid="card-sales-main-now-inactive-dealers"
            className="block rounded-2xl border border-border bg-card p-4 shadow-md no-underline transition-shadow hover:shadow-lg sm:p-5"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Без активности</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{kpis.inactiveDealers}</p>
            <p className="mt-2 text-sm text-muted-foreground">Клиенты без недавних событий</p>
          </Link>
          <Link
            href="/dealer-base"
            data-testid="card-sales-main-now-matrix-gaps"
            className="block rounded-2xl border border-border bg-card p-4 shadow-md no-underline transition-shadow hover:shadow-lg sm:p-5"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Матрица / точки</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{kpis.matrixGaps}</p>
            <p className="mt-2 text-sm text-muted-foreground">Точки с низкой дистрибуцией или задачами</p>
          </Link>
          <Link
            href="/catalog"
            data-testid="card-sales-main-now-focus-products"
            className="block rounded-2xl border border-primary/25 bg-primary/10 p-4 shadow-md no-underline transition-shadow hover:shadow-lg sm:p-5 sm:col-span-2 lg:col-span-1"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-foreground">Товары в фокусе</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{kpis.focusProducts}</p>
            <p className="mt-2 text-sm text-muted-foreground">Приоритет продвижения и связанные задачи</p>
          </Link>
        </div>
      </section>

      <section className="space-y-4" data-testid="section-sales-manager-dealers">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Мои клиенты</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {myDealers.map((d) => (
            <Card key={d.id} className="rounded-2xl border border-border/80 bg-card shadow-md">
              <CardHeader className="space-y-2 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={cn("text-xs", statusBadgeClass(d.status))}>
                    {d.status}
                  </Badge>
                  <Badge variant="outline" className={cn("text-xs", categoryBadgeClass(d.category))}>
                    {d.category}
                  </Badge>
                </div>
                <CardTitle className="text-base leading-snug sm:text-lg">{d.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{d.city}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Активность:</span> {d.lastActivity}
                </p>
                <p>
                  <span className="font-medium text-foreground">Дальше:</span> {d.nextAction}
                </p>
                <p>
                  <span className="font-medium text-foreground">Торговых точек:</span> {d.outlets}
                </p>
                <Button asChild className="mt-2 w-full min-h-10 font-semibold" data-testid={`button-sales-manager-open-dealer-${d.id}`}>
                  <Link href={`/dealers/${d.id}`}>Открыть</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-sales-manager-orders">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground sm:text-xl">Заказы клиентов</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Заказы приходят менеджеру через тот же синхронизированный контур ЛК дилера: новые,
              на подтверждении, проблемы оплаты или отгрузки, изменения и связь с матрицей.
            </p>
          </div>
        </div>
        {managerOrders.length === 0 ? (
          <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
            <CardContent className="p-5 text-sm text-muted-foreground">
              Сейчас по вашим клиентам нет заказов, требующих внимания менеджера.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {managerOrders.map((order) => (
              <Card
                key={order.id}
                className="rounded-2xl border border-border/80 bg-card shadow-md"
                data-testid={`card-sales-manager-order-${order.id}`}
              >
                <CardHeader className="space-y-2 pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs font-medium", ORDER_STATUS_TONE[order.status])}>
                      {order.status}
                    </Badge>
                    <Badge variant="outline" className={cn("text-xs font-medium", ORDER_PAYMENT_TONE[order.paymentStatus])}>
                      Оплата: {order.paymentStatus}
                    </Badge>
                    <Badge variant="outline" className={cn("text-xs font-medium", ORDER_SHIPMENT_TONE[order.shipmentStatus])}>
                      Отгрузка: {order.shipmentStatus}
                    </Badge>
                  </div>
                  <CardTitle className="text-base leading-snug sm:text-lg">
                    Заказ {order.number}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{order.dealerName}</p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Склад:</span> {order.warehouseName}
                  </p>
                  {order.tradePointName ? (
                    <p>
                      <span className="font-medium text-foreground">Точка:</span> {order.tradePointName}
                    </p>
                  ) : null}
                  <p>
                    <span className="font-medium text-foreground">Объём:</span> {order.totalAmountLabel}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Позиций:</span>{" "}
                    <span className="tabular-nums">{order.items.length}</span>
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Дальше:</span> {order.nextAction}
                  </p>
                  {order.attentionFlags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {order.attentionFlags.slice(0, 4).map((flag) => (
                        <Badge
                          key={`${order.id}-${flag}`}
                          variant="outline"
                          className={cn("text-[11px] font-medium", ORDER_FLAG_TONE[flag])}
                        >
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <Button
                    asChild
                    className="mt-2 w-full min-h-10 font-semibold"
                    data-testid={`button-sales-manager-open-order-${order.id}`}
                  >
                    <Link href={`/orders/${order.id}`}>Открыть заказ</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4" data-testid="section-sales-manager-tasks">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Задачи по продажам</h2>
        <div className="space-y-3">
          {tasks.map((t) => (
            <Card key={t.taskId} className="rounded-2xl border border-border/80 bg-card shadow-md" data-testid={`card-sales-manager-task-${t.taskId}`}>
              <CardContent className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-semibold text-foreground">{t.title}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={cn("text-xs font-semibold", priorityBadgeClass(t.priority))}>
                      {MATRIX_TASK_PRIORITY_LABEL[t.priority]}
                    </Badge>
                    <Badge variant="outline" className={cn("text-xs font-semibold", matrixStatusBadgeClass(t))}>
                      {MATRIX_TASK_STATUS_LABEL[t.status]}
                    </Badge>
                    {isMatrixTaskOverdue(t.dueDate) && t.status !== "done" ? (
                      <Badge variant="outline" className="border-red-200 bg-red-50 text-xs text-red-900">
                        Срок истёк
                      </Badge>
                    ) : isMatrixTaskDueToday(t.dueDate) && t.status !== "done" ? (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-xs text-amber-950">
                        Сегодня
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <Separator />
                <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  <p>
                    <span className="font-medium text-foreground">Срок:</span> {t.dueDate}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Клиент:</span> {t.dealerName}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Точка:</span> {t.tradePointName}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Товар:</span> {t.productName}
                  </p>
                </div>
                <Button asChild variant="default" className="w-full min-h-10 font-semibold" data-testid={`button-sales-manager-open-task-context-${t.taskId}`}>
                  <Link href={matrixTaskContextHref(t)}>Перейти к контексту</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-sales-manager-focus-products">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Товары в фокусе</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {focusProducts.map((p) => (
            <Card key={p.id} className="rounded-2xl border border-border/80 bg-card shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base leading-snug">{p.name}</CardTitle>
                <p className="font-mono text-xs text-muted-foreground">{p.article}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  {p.category} · {p.series}
                </p>
                <p>
                  <span className="text-muted-foreground">Приоритет продаж:</span>{" "}
                  <span className="font-semibold text-foreground">{p.salesPriority}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Связанных задач:</span>{" "}
                  <span className="font-semibold text-foreground">{p.relatedTaskCount}</span>
                </p>
                <Button asChild variant="outline" className="mt-2 w-full min-h-10 border-border bg-card font-semibold" data-testid={`button-sales-manager-open-product-${p.id}`}>
                  <Link href={`/catalog/${p.id}`}>Открыть товар</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-sales-manager-trade-points">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Торговые точки требуют внимания</h2>
        <div className="space-y-3">
          {attentionPoints.map((row) => (
            <Card key={`${row.dealerId}-${row.point.id}`} className="rounded-2xl border border-border/80 bg-card shadow-md">
              <CardContent className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">{row.point.name}</p>
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-xs font-medium text-amber-950">
                    Матрица {row.matrixPercent}%
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{row.dealerName}</span> · {row.point.city}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Статус точки:</span> {row.point.status}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Зона:</span> {row.zoneLabel}
                </p>
                <p className="text-xs text-muted-foreground">{row.reason}</p>
                <Button
                  asChild
                  variant="default"
                  className="w-full min-h-10 font-semibold"
                  data-testid={`button-sales-manager-open-trade-point-${row.point.id}`}
                >
                  <Link href={`/dealers/${row.dealerId}/trade-points/${row.point.id}`}>Открыть точку</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-sales-manager-quick-actions">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Быстрые действия</h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-10 border-border bg-card">
            <Link href="/dealer-base">Клиентская база</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-10 border-border bg-card">
            <Link href="/catalog">Каталог</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-10 border-border bg-card">
            <Link href="/tasks">Задачи</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-10 border-border bg-card">
            <Link href="/dealer-base">Клиенты без активности</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-10 border-border bg-card">
            <Link href="/catalog">Товары в фокусе</Link>
          </Button>
        </div>
      </section>

      <FloatingBackButton
        href="/dealer-base"
        label="К клиентской базе"
        testId="floating-back-to-dealer-base"
        ariaLabel="Назад к клиентской базе"
      />
    </div>
  );
}
