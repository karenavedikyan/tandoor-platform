import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertCircle, ArrowRightCircle, MapPin, Network, Store, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DealerListItem } from "@/lib/api-types";
import {
  clientLifecycleStatusLabel,
  dealerTypeLabel,
  dealerStatusLabel,
  importSourceLabel,
  potentialLevelLabel,
} from "@/lib/labels";

type QuickFilter = "all" | "network" | "single" | "high" | "development";

const filterChips: { id: QuickFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "network", label: "Сетевые" },
  { id: "single", label: "Одиночные" },
  { id: "high", label: "Высокий потенциал" },
  { id: "development", label: "В развитии" },
];

export default function DealersPage() {
  const [filter, setFilter] = useState<QuickFilter>("all");

  const {
    data: dealers,
    isLoading: isDealersLoading,
    isError: isDealersError,
    error: dealersError,
  } = useQuery<DealerListItem[]>({
    queryKey: ["/api/dealers"],
  });

  const filtered = useMemo(() => {
    if (!dealers) {
      return [];
    }
    if (filter === "all") {
      return dealers;
    }
    if (filter === "network") {
      return dealers.filter((d) => d.dealerType === "network");
    }
    if (filter === "single") {
      return dealers.filter((d) => d.dealerType === "single");
    }
    if (filter === "high") {
      return dealers.filter((d) => d.potentialLevel === "high");
    }
    if (filter === "development") {
      return dealers.filter((d) => d.status === "development");
    }
    return dealers;
  }, [dealers, filter]);

  const kpis = useMemo(() => {
    if (!dealers) {
      return { total: 0, tradePoints: 0, network: 0, activeTasks: 0 };
    }
    return {
      total: dealers.length,
      tradePoints: dealers.reduce((a, d) => a + d.tradePointCount, 0),
      network: dealers.filter((d) => d.dealerType === "network").length,
      activeTasks: dealers.reduce((a, d) => a + d.activeTaskCount, 0),
    };
  }, [dealers]);

  if (isDealersLoading) {
    return (
      <section className="space-y-4" data-testid="page-dealers">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (isDealersError) {
    return (
      <Alert variant="destructive" data-testid="page-dealers">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Не удалось загрузить дилеров</AlertTitle>
        <AlertDescription>
          {dealersError instanceof Error
            ? dealersError.message
            : "Произошла непредвиденная ошибка при загрузке дилеров."}
        </AlertDescription>
      </Alert>
    );
  }

  if (!dealers?.length) {
    return (
      <Card data-testid="page-dealers">
        <CardHeader>
          <CardTitle>Дилеры пока отсутствуют</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Дилерские компании появятся здесь после подключения к платформе.
        </CardContent>
      </Card>
    );
  }

  return (
    <section
      className="space-y-6 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-6"
      data-testid="page-dealers"
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Клиентская база дилеров</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-3xl">
          Общие клиенты отдела продаж: менеджеры, региональные менеджеры, торговые точки и задачи
        </p>
        <div className="mt-3">
          <Button
            asChild
            variant="outline"
            className="h-10 rounded-xl bg-white"
            data-testid="button-open-client-import"
          >
            <Link href="/sales/client-import">
              Импорт базы
              <ArrowRightCircle className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[14px] border border-border/80 bg-white p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Всего дилеров</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{kpis.total}</p>
        </div>
        <div className="rounded-[14px] border border-border/80 bg-white p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Торговых точек</p>
          <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground">
            <Store className="h-5 w-5 text-primary" />
            {kpis.tradePoints}
          </p>
        </div>
        <div className="rounded-[14px] border border-border/80 bg-white p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Сетевых клиентов</p>
          <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground">
            <Network className="h-5 w-5 text-primary" />
            {kpis.network}
          </p>
        </div>
        <div className="rounded-[14px] border border-border/80 bg-white p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Активных задач</p>
          <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground">
            <Target className="h-5 w-5 text-primary" />
            {kpis.activeTasks}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setFilter(chip.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === chip.id
                ? "border-primary/50 bg-primary/15 text-foreground"
                : "border-border/80 bg-white text-muted-foreground hover:border-border",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((dealer) => (
          <Card
            key={dealer.id}
            data-testid={`card-dealer-${dealer.id}`}
            className="flex flex-col rounded-2xl border-border/80 shadow-sm"
          >
            <CardHeader className="space-y-2 pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle
                  className="text-base font-semibold leading-tight"
                  data-testid={`text-dealer-name-${dealer.id}`}
                >
                  {dealer.name}
                </CardTitle>
                <StatusBadge type="dealer" status={dealer.status} />
              </div>
              <p
                className="text-sm text-muted-foreground"
                data-testid={`text-dealer-type-${dealer.id}`}
              >
                {dealerTypeLabel(dealer.dealerType)} · {dealer.segment ?? "—"}
              </p>
            </CardHeader>
            <CardContent className="mt-auto space-y-3 text-sm">
              <div className="flex items-start gap-2 text-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>
                  {dealer.city ?? "—"}, {dealer.region ?? "—"}
                </span>
              </div>
              <p>
                <span className="text-muted-foreground">Потенциал: </span>
                {dealer.potentialLevel ? potentialLevelLabel(dealer.potentialLevel) : "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Статус: </span>
                {dealerStatusLabel(dealer.status)}
              </p>
              <div className="space-y-1">
                <p
                  className="flex items-center gap-1"
                  data-testid={`text-dealer-sales-manager-${dealer.id}`}
                >
                  <span className="text-muted-foreground">Менеджер продаж:</span>{" "}
                  <span className="font-medium text-foreground">{dealer.salesManagerName}</span>
                </p>
                <p
                  className="flex items-center gap-1"
                  data-testid={`text-dealer-regional-manager-${dealer.id}`}
                >
                  <span className="text-muted-foreground">Региональный:</span>{" "}
                  <span className="font-medium text-foreground">{dealer.regionalManagerName}</span>
                </p>
              </div>
              <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <p data-testid={`text-dealer-client-status-${dealer.id}`}>
                  Статус клиента: {clientLifecycleStatusLabel(dealer.clientLifecycleStatus)}
                </p>
                <p data-testid={`text-dealer-source-${dealer.id}`}>
                  Источник: {importSourceLabel(dealer.source)}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Торговых точек: {dealer.tradePointCount}</span>
                <span>Активных задач: {dealer.activeTaskCount}</span>
              </div>
              <Button
                asChild
                className="w-full rounded-xl"
                data-testid={`button-open-dealer-${dealer.id}`}
              >
                <Link href={`/dealers/${dealer.id}`}>Открыть карточку</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
