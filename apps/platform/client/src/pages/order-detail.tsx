import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { ChevronRight, Package, MapPin, Store, Warehouse, History as HistoryIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { cn } from "@/lib/utils";
import {
  getOrderById,
  getDealerWarehouses,
  ORDER_FLAG_TONE,
  ORDER_PAYMENT_TONE,
  ORDER_SHIPMENT_TONE,
  ORDER_STATUS_TONE,
  type DealerWarehouse,
  type OrderItem,
  type OrderRow,
} from "@/lib/order-data";

function OrderNotFound() {
  return (
    <div className="mx-auto max-w-md space-y-6 py-8" data-testid="page-order-not-found">
      <Button asChild variant="outline" className="min-h-11 w-full border-border bg-card" data-testid="button-back-to-sales-manager">
        <Link href="/sales-manager">К кабинету менеджера</Link>
      </Button>
      <Card className="rounded-2xl border border-border bg-card shadow-md">
        <CardHeader>
          <CardTitle className="text-xl">Заказ не найден</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Проверьте номер заказа или вернитесь к кабинету менеджера.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function itemAvailabilityTone(a: OrderItem["availability"]) {
  if (a === "в наличии") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (a === "недостаточно") return "border-red-200 bg-red-50 text-red-900";
  if (a === "ожидание поставки") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-sky-200 bg-sky-50 text-sky-950";
}

function matrixTone(m: OrderItem["linkedMatrixStatus"]) {
  if (m === "входит в матрицу") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (m === "вне матрицы") return "border-border bg-muted/60 text-foreground";
  if (m === "рекомендован к матрице") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-sky-200 bg-sky-50 text-sky-950";
}

function showcaseTone(s: OrderItem["linkedShowcaseStatus"]) {
  if (s === "присутствует на витрине") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (s === "отсутствует на витрине") return "border-amber-200 bg-amber-50 text-amber-950";
  if (s === "под проверку") return "border-sky-200 bg-sky-50 text-sky-950";
  return "border-border bg-muted/60 text-foreground";
}

function OrderDetailContent({ order }: { order: OrderRow }) {
  const warehouses: DealerWarehouse[] = useMemo(() => getDealerWarehouses(order.dealerId), [order.dealerId]);
  const warehouse = useMemo(
    () => warehouses.find((w) => w.warehouseId === order.warehouseId),
    [warehouses, order.warehouseId],
  );
  const totalQuantity = useMemo(
    () => order.items.reduce((sum, it) => sum + it.quantity, 0),
    [order.items],
  );

  return (
    <div className="space-y-4 pb-24 sm:space-y-6" data-testid="page-order-detail">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        <Button
          asChild
          variant="outline"
          className="min-h-11 w-full border-border bg-card sm:w-auto"
          data-testid="button-back-to-sales-manager"
        >
          <Link href="/sales-manager">К кабинету менеджера</Link>
        </Button>
        <Button
          asChild
          variant="secondary"
          className="min-h-11 w-full border-border sm:w-auto"
          data-testid="button-back-to-dealer-card"
        >
          <Link href={`/dealers/${order.dealerId}`}>К карточке дилера</Link>
        </Button>
        {order.tradePointId ? (
          <Button
            asChild
            variant="outline"
            className="min-h-11 w-full border-border bg-card sm:w-auto"
            data-testid="button-back-to-trade-point"
          >
            <Link href={`/dealers/${order.dealerId}/trade-points/${order.tradePointId}`}>
              К торговой точке
            </Link>
          </Button>
        ) : null}
      </div>

      <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground sm:text-sm" aria-label="Навигация">
        <Link href="/sales-manager" className="font-medium text-foreground underline-offset-4 hover:underline">
          Кабинет менеджера
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        <Link href={`/dealers/${order.dealerId}`} className="font-medium text-foreground underline-offset-4 hover:underline">
          {order.dealerName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="font-medium text-foreground">Заказ {order.number}</span>
      </nav>

      <section
        id="section-order-overview"
        data-testid="section-order-overview"
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8"
      >
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative pl-3 sm:pl-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", ORDER_STATUS_TONE[order.status])}>
              {order.status}
            </Badge>
            <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", ORDER_PAYMENT_TONE[order.paymentStatus])}>
              Оплата: {order.paymentStatus}
            </Badge>
            <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", ORDER_SHIPMENT_TONE[order.shipmentStatus])}>
              Отгрузка: {order.shipmentStatus}
            </Badge>
            <Badge variant="outline" className="rounded-full border-border bg-muted/50 px-2.5 py-0.5 font-medium text-muted-foreground">
              Источник: {order.source}
            </Badge>
            <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-900">
              Контур: {order.syncOrigin}
            </Badge>
          </div>
          <div className="mt-4 flex items-start gap-3">
            <Package className="mt-1 h-6 w-6 shrink-0 text-primary sm:h-7 sm:w-7" aria-hidden />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Заказ {order.number}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                {order.dealerName} · обновлён {order.updatedAt}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Дата заказа: </span>
              <span className="font-medium text-foreground">{order.date}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Менеджер: </span>
              <span className="font-medium text-foreground">{order.manager}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Объём заказа: </span>
              <span className="font-medium text-foreground">{order.totalAmountLabel}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Позиций: </span>
              <span className="font-medium text-foreground">
                {order.items.length} · всего {totalQuantity} шт.
              </span>
            </p>
          </div>
          {order.attentionFlags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {order.attentionFlags.map((flag) => (
                <Badge
                  key={flag}
                  variant="outline"
                  className={cn("text-xs font-medium", ORDER_FLAG_TONE[flag])}
                >
                  {flag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section
        id="section-order-actions"
        data-testid="section-order-actions"
        className="rounded-2xl border border-border/80 bg-card p-4 shadow-md sm:p-5"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ближайшее действие менеджера</p>
        <p className="mt-2 text-base font-semibold text-foreground sm:text-lg">{order.nextAction}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Заказ виден менеджеру через тот же синхронизированный контур ЛК дилера, без отдельной модели.
        </p>
      </section>

      <section
        id="section-order-warehouse"
        data-testid="section-order-warehouse"
        className="space-y-3"
      >
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Склад дилера</h2>
        <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
          <CardContent className="space-y-2 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Warehouse className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <p className="font-semibold text-foreground">{order.warehouseName}</p>
              {warehouse?.isPrimary ? (
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-xs font-medium text-primary">
                  Основной
                </Badge>
              ) : null}
              {warehouse ? (
                <Badge variant="outline" className="border-border bg-muted/60 text-xs font-medium text-foreground">
                  {warehouse.type}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Город:</span> {order.warehouseCity}
            </p>
            {warehouse ? (
              <>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Регион:</span> {warehouse.region}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Зона доставки:</span> {warehouse.deliveryZone}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Статус склада:</span> {warehouse.status}
                </p>
                {warehouse.tradePointIds.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Обслуживает точек:</span> {warehouse.tradePointIds.length}
                  </p>
                ) : null}
              </>
            ) : null}
            <Separator className="my-2" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Направление:</span> {order.deliveryDirection}
            </p>
          </CardContent>
        </Card>

        {warehouses.length > 1 ? (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Другие склады дилера
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {warehouses
                .filter((w) => w.warehouseId !== order.warehouseId)
                .map((w) => (
                  <Card key={w.warehouseId} className="rounded-2xl border border-border/80 bg-card shadow-sm">
                    <CardContent className="space-y-1 p-4 text-sm">
                      <p className="font-semibold text-foreground">{w.name}</p>
                      <p className="text-muted-foreground">
                        {w.city} · {w.type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Зона: {w.deliveryZone} · Статус: {w.status}
                      </p>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        ) : null}
      </section>

      {order.tradePointId && order.tradePointName ? (
        <section
          id="section-order-trade-point"
          data-testid="section-order-trade-point"
          className="space-y-3"
        >
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">Торговая точка</h2>
          <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
            <CardContent className="space-y-2 p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <p className="font-semibold text-foreground">{order.tradePointName}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Дилер:</span> {order.dealerName}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Город склада:</span> {order.warehouseCity}
              </p>
              <Button
                asChild
                variant="outline"
                className="mt-2 min-h-10 w-full border-border bg-card sm:w-auto"
                data-testid={`button-open-trade-point-from-order-${order.id}`}
              >
                <Link href={`/dealers/${order.dealerId}/trade-points/${order.tradePointId}`}>
                  Открыть торговую точку
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section
        id="section-order-items"
        data-testid="section-order-items"
        className="space-y-3"
      >
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Позиции заказа</h2>
        <div className="space-y-3">
          {order.items.map((item) => (
            <Card
              key={`${order.id}-${item.productId}`}
              className="rounded-2xl border border-border/80 bg-card shadow-md"
              data-testid={`card-order-item-${item.productId}`}
            >
              <CardContent className="space-y-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug text-foreground">{item.productName}</p>
                    <p className="font-mono text-xs text-muted-foreground">{item.productArticle}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <Badge variant="outline" className={cn("text-xs font-medium", itemAvailabilityTone(item.availability))}>
                      {item.availability}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Категория</p>
                    <p className="mt-0.5 font-medium text-foreground">{item.category}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Кол-во</p>
                    <p className="mt-0.5 font-medium text-foreground tabular-nums">
                      {item.quantity} {item.unit}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Склад</p>
                    <p className="mt-0.5 font-medium text-foreground">{item.warehouseStatus}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className={cn("text-xs font-medium", matrixTone(item.linkedMatrixStatus))}>
                    Матрица: {item.linkedMatrixStatus}
                  </Badge>
                  <Badge variant="outline" className={cn("text-xs font-medium", showcaseTone(item.linkedShowcaseStatus))}>
                    Витрина: {item.linkedShowcaseStatus}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section
        id="section-order-matrix"
        data-testid="section-order-matrix"
        className="space-y-3"
      >
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Связь с матрицей и витриной</h2>
        <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
          <CardContent className="space-y-2 p-4 sm:p-5 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Позиций в матрице точки:</span>{" "}
              <span className="tabular-nums">
                {order.items.filter((i) => i.linkedMatrixStatus === "входит в матрицу").length}
              </span>
            </p>
            <p>
              <span className="font-medium text-foreground">Рекомендованы к матрице:</span>{" "}
              <span className="tabular-nums">
                {order.items.filter((i) => i.linkedMatrixStatus === "рекомендован к матрице").length}
              </span>
            </p>
            <p>
              <span className="font-medium text-foreground">Отсутствуют на витрине:</span>{" "}
              <span className="tabular-nums">
                {order.items.filter((i) => i.linkedShowcaseStatus === "отсутствует на витрине").length}
              </span>
            </p>
            <p className="text-xs">
              Состав заказа и его связь с матрицей формируются в едином контуре с ЛК дилера.
            </p>
          </CardContent>
        </Card>
      </section>

      <section
        id="section-order-history"
        data-testid="section-order-history"
        className="space-y-3"
      >
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">История</h2>
        <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
          <CardContent className="divide-y divide-border pt-2">
            {order.history.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-col gap-1 py-3 first:pt-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-2">
                  <HistoryIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <p className="text-sm font-medium text-foreground">{ev.text}</p>
                </div>
                <time className="shrink-0 text-xs tabular-nums text-muted-foreground sm:pl-6">{ev.date}</time>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <FloatingBackButton
        href="/sales-manager"
        label="К кабинету менеджера"
        testId="floating-back-to-sales-manager"
        ariaLabel="Назад к кабинету менеджера"
      />
    </div>
  );
}

export function OrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const id = params.orderId ?? "";
  const order = getOrderById(id);
  if (!order) return <OrderNotFound />;
  return <OrderDetailContent order={order} />;
}

export default OrderDetailPage;
