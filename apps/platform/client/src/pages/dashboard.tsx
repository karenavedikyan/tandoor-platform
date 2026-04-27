import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ChevronRight,
  Network,
  ScrollText,
  PlusCircle,
  ShoppingCart,
  ClipboardList,
  Boxes,
  Activity,
  UsersRound,
  FileWarning,
} from "lucide-react";
import type { ActivityEvent, Claim, Dealer, Order, Product } from "@/lib/api-types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatDateTime, statusLabel } from "@/lib/format";

function statusSummary(orders: Order[]) {
  const counters = new Map<string, number>();
  for (const order of orders) {
    counters.set(order.status, (counters.get(order.status) ?? 0) + 1);
  }
  return Array.from(counters.entries()).sort((a, b) => b[1] - a[1]);
}

export default function DashboardPage() {
  const dealersQuery = useQuery<Dealer[]>({ queryKey: ["/api/dealers"] });
  const productsQuery = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const ordersQuery = useQuery<Order[]>({ queryKey: ["/api/orders"] });
  const claimsQuery = useQuery<Claim[]>({ queryKey: ["/api/claims"] });
  const activityQuery = useQuery<ActivityEvent[]>({ queryKey: ["/api/activity"] });

  const isLoading =
    dealersQuery.isLoading ||
    productsQuery.isLoading ||
    ordersQuery.isLoading ||
    claimsQuery.isLoading ||
    activityQuery.isLoading;

  const error =
    dealersQuery.error ??
    productsQuery.error ??
    ordersQuery.error ??
    claimsQuery.error ??
    activityQuery.error;
  const errorMessage = error instanceof Error ? error.message : "Неожиданная ошибка";

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="dashboard-loading">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Card key={item}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card data-testid="dashboard-error">
        <CardHeader>
          <CardTitle>Дашборд временно недоступен</CardTitle>
          <CardDescription>Не удалось загрузить один или несколько источников данных.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
        </CardContent>
      </Card>
    );
  }

  const dealers = dealersQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const claims = claimsQuery.data ?? [];
  const activity = (activityQuery.data ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const activeOrders = orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length;
  const openClaims = claims.filter((claim) => !["resolved", "rejected"].includes(claim.status)).length;
  const recentActivity = activity.slice(0, 5);
  const recentOrders = orders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  const quickTiles = [
    { href: "/dealers", label: "Дилеры", icon: Building2 },
    { href: "/catalog", label: "Каталог", icon: Boxes },
    { href: "/orders", label: "Заказы", icon: ShoppingCart },
    { href: "/claims", label: "Рекламации", icon: ScrollText },
    { href: "/activity", label: "События", icon: Activity },
    { href: "/architecture", label: "Архитектура", icon: Network },
  ];

  const kpiCards = [
    { label: "Дилеры", value: dealers.length, icon: UsersRound },
    { label: "Активные заказы", value: activeOrders, icon: ClipboardList },
    { label: "Товары в каталоге", value: products.length, icon: Boxes },
    { label: "Открытые рекламации", value: openClaims, icon: FileWarning },
  ];

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Главная</p>
        <h1 className="text-[24px] font-bold leading-tight text-foreground">Платформа Tandoor</h1>
        <p className="text-sm text-muted-foreground">Добро пожаловать в операционный кабинет дилерского контура.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="dashboard-quick-tiles">
        {quickTiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="group rounded-[14px] border border-border/80 bg-[#e8e8e8] px-4 py-4 transition-colors hover:bg-[#e2e2e2]"
            data-testid={`quick-tile-${tile.href.replace("/", "") || "root"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{tile.label}</p>
              <tile.icon className="size-4 text-foreground/70 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>

      <div>
        <Button
          asChild
          data-testid="button-create-order"
          className="h-11 w-full rounded-[10px] bg-primary text-[13px] font-bold uppercase tracking-[0.08em] text-primary-foreground hover:bg-primary/90"
        >
          <Link href="/orders/new">
            <PlusCircle className="size-4" />
            Создать заказ
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <Card key={card.label} data-testid={`kpi-${card.label.toLowerCase().replaceAll(" ", "-")}`}>
            <CardHeader className="space-y-3 pb-4">
              <div className="flex items-center justify-between">
                <CardDescription>{card.label}</CardDescription>
                <card.icon className="size-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-3xl">{card.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.45fr,1fr]">
        <Card data-testid="orders-status-summary">
          <CardHeader>
            <CardTitle className="text-xl uppercase tracking-[0.06em]">Статусы заказов</CardTitle>
            <CardDescription>Текущее распределение заказов</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusSummary(orders).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between rounded-lg border border-border/80 bg-background p-3">
                <div className="flex items-center gap-2">
                  <StatusBadge type="order" status={status} />
                  <span className="text-sm text-muted-foreground">{statusLabel(status)}</span>
                </div>
                <span className="text-sm font-semibold">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card data-testid="quick-links-card">
          <CardHeader>
            <CardTitle className="text-xl uppercase tracking-[0.06em]">Быстрые действия</CardTitle>
            <CardDescription>Переход к ключевым разделам</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickTiles.slice(0, 4).map((link) => (
              <Button
                key={link.href}
                asChild
                variant="outline"
                className="h-10 w-full justify-between rounded-[10px] border-border/80 bg-muted/30"
                data-testid={`quick-link-${link.href.replace("/", "") || "root"}`}
              >
                <Link href={link.href}>
                  <span className="flex items-center gap-2">
                    <link.icon className="size-4" />
                    {link.label}
                  </span>
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card data-testid="recent-orders-card">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-xl">Последние заказы</CardTitle>
              <CardDescription>Актуальные заказы дилерского контура</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/orders">Смотреть все</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentOrders.map((order) => (
              <div key={order.id} className="rounded-lg border border-border/80 bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge type="order" status={order.status} />
                    <p className="mt-1 text-sm font-medium">{formatCurrency(order.totalCents, order.currency)}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card data-testid="recent-activity-card">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-xl">Последние события</CardTitle>
              <CardDescription>Ключевые события жизненного цикла</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/activity">Открыть журнал</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.map((event) => (
              <div key={event.id} className="rounded-lg border border-border/80 bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{statusLabel(event.eventType)}</p>
                    <p className="text-sm text-muted-foreground">{event.message}</p>
                  </div>
                  <ArrowUpRight className="mt-1 size-4 text-muted-foreground" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
