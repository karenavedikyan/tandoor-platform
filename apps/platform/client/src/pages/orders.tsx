import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { cn } from "@/lib/utils";
import {
  applyOrdersQuickFilter,
  applyOrdersSearch,
  getAllOrders,
  orderNeedsManagerAttention,
  summarizeOrdersKpis,
  type OrderRow,
  type OrdersQuickFilter,
} from "@/lib/order-data";

const QUICK_FILTERS: { id: OrdersQuickFilter; label: string; testId: string }[] = [
  { id: "all", label: "Все", testId: "filter-orders-all" },
  { id: "new", label: "Новые / на подтверждении", testId: "filter-orders-new" },
  { id: "payment", label: "Проблемы оплаты", testId: "filter-orders-payment" },
  { id: "shipment", label: "Проблемы отгрузки", testId: "filter-orders-shipment" },
  { id: "attention", label: "Требуют внимания", testId: "filter-orders-attention" },
];

function attentionBadge(o: OrderRow) {
  if (!orderNeedsManagerAttention(o)) return null;
  return (
    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-xs font-medium text-amber-950">
      Внимание
    </Badge>
  );
}

function OrderListCard({ o }: { o: OrderRow }) {
  return (
    <Card className="rounded-2xl border border-border/80 bg-card shadow-md" data-testid={`card-order-${o.id}`}>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-foreground">{o.number}</p>
            <p className="text-xs text-muted-foreground">{o.date}</p>
          </div>
          {attentionBadge(o)}
        </div>
        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <p>
            <span className="font-medium text-foreground">Клиент:</span> {o.dealerName}
          </p>
          <p>
            <span className="font-medium text-foreground">Склад:</span> {o.warehouseName}
          </p>
          {o.tradePointName ? (
            <p>
              <span className="font-medium text-foreground">Точка:</span> {o.tradePointName}
            </p>
          ) : null}
          <p>
            <span className="font-medium text-foreground">Статус:</span> {o.status}
          </p>
          <p>
            <span className="font-medium text-foreground">Оплата:</span> {o.paymentStatus}
          </p>
          <p>
            <span className="font-medium text-foreground">Отгрузка:</span> {o.shipmentStatus}
          </p>
          <p>
            <span className="font-medium text-foreground">Позиций:</span> {o.items.length}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Дальше:</span> {o.nextAction}
        </p>
        <Button asChild className="w-full min-h-10 font-semibold" data-testid={`button-open-order-${o.id}`}>
          <Link href={`/orders/${o.id}`}>Открыть</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function OrdersPage() {
  const allOrders = useMemo(() => getAllOrders(), []);
  const [quick, setQuick] = useState<OrdersQuickFilter>("all");
  const [search, setSearch] = useState("");
  const kpis = useMemo(() => summarizeOrdersKpis(allOrders), [allOrders]);
  const filtered = useMemo(() => {
    return applyOrdersSearch(applyOrdersQuickFilter(allOrders, quick), search);
  }, [allOrders, quick, search]);

  return (
    <div className="space-y-6 pb-24 sm:space-y-8" data-testid="page-orders">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8" data-testid="section-orders-hero">
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative space-y-4 pl-3 sm:pl-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Заказы</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Журнал заказов клиентов, складов и отгрузок.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="min-h-10 font-semibold" data-testid="button-orders-open-main">
              <Link href="/main">К главному</Link>
            </Button>
            <Button asChild variant="secondary" className="min-h-10 font-semibold" data-testid="button-orders-open-dealers">
              <Link href="/dealer-base">К клиентской базе</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-10 border-border bg-card font-semibold" data-testid="button-orders-open-tasks">
              <Link href="/tasks">К задачам</Link>
            </Button>
          </div>
        </div>
      </section>

      <section data-testid="section-orders-kpis">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Всего", value: kpis.total },
            { label: "Требуют внимания", value: kpis.attention },
            { label: "На подтверждении", value: kpis.awaiting },
            { label: "Проблемы оплаты", value: kpis.pay },
            { label: "Проблемы отгрузки", value: kpis.ship },
          ].map((k) => (
            <Card key={k.label} className="rounded-xl border border-border/80 bg-card shadow-sm">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{k.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-orders-filters">
        <div className="relative">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Номер, клиент, точка, склад, товар…"
            className="min-h-11 rounded-xl border-border bg-card"
            data-testid="input-orders-search"
            aria-label="Поиск по заказам"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setQuick(f.id)}
              data-testid={f.testId}
              className={cn(
                "min-h-10 shrink-0 rounded-full border px-3.5 py-2 text-left text-sm font-medium transition-colors",
                quick === f.id
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <p className="text-sm text-muted-foreground">
        Показано: <span className="font-semibold tabular-nums text-foreground">{filtered.length}</span>
      </p>

      <section className="space-y-3" data-testid="section-orders-list">
        {filtered.length === 0 ? (
          <Card className="rounded-2xl border border-border bg-card">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">Нет заказов по выбранным условиям.</CardContent>
          </Card>
        ) : (
          filtered.map((o) => <OrderListCard key={o.id} o={o} />)
        )}
      </section>

      <FloatingBackButton href="/main" label="К главному" testId="floating-back-to-main" ariaLabel="К главному экрану" />
    </div>
  );
}
