import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ChevronRight, Info, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { isClientTopTier } from "@/lib/client-category";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import {
  dealerBelongsToTerritoryCityDisplayName,
  type TerritoryCardLivePack,
} from "@/lib/territory-card-live-data";
import { getDealerManagerDisplay, getDealerRopDisplay, type DealerRow } from "@/lib/dealer-base-mock-data";
import {
  MATRIX_TASK_PRIORITY_LABEL,
  MATRIX_TASK_STATUS_LABEL,
  MATRIX_TASK_TYPE_LABEL,
  type MatrixTaskWithContext,
} from "@/lib/trade-point-task-data";
import { cn } from "@/lib/utils";
import type { TerritoryCitySummary, TerritoryPlanLine, TerritoryRiskItem } from "@/lib/territory-card-data";

export type TerritoryCockpitDetail =
  | { kind: "kpi-clients" }
  | { kind: "kpi-trade-points" }
  | { kind: "kpi-showcase-tasks" }
  | { kind: "kpi-showcase-control" }
  | { kind: "kpi-attention" }
  | { kind: "city"; cityId: string };

type CitySortKey = "dealers" | "tradePoints" | "tasks" | "attention";
type CityChip = "all" | "tasks" | "noTp" | "withTp" | "top";

function planCardTestId(key: TerritoryPlanLine["key"]) {
  if (key === "mk") return "card-territory-plan-mk";
  if (key === "vh") return "card-territory-plan-vh";
  return "card-territory-plan-hardware";
}

function showcaseHintForTp(tpId: string, merged: ActualizationState): string | null {
  const sh = merged.tradePointShowcaseActualizationById[tpId];
  if (!sh?.updatedAt?.trim()) return null;
  if (sh.hasShowcase === true) return "Витрина: да (актуализация)";
  if (sh.hasShowcase === false) return "Витрина: нет (актуализация)";
  return "Актуализация витрины сохранена";
}

function attentionForCity(city: TerritoryCitySummary, risks: TerritoryRiskItem[]): number {
  return risks.filter((r) => r.city === city.name).length;
}

function cityHasTopClient(dealers: DealerRow[], city: TerritoryCitySummary): boolean {
  return dealers.some((d) => dealerBelongsToTerritoryCityDisplayName(d, city.name) && isClientTopTier(d.clientCategory));
}

function cityDealers(dealers: DealerRow[], city: TerritoryCitySummary): DealerRow[] {
  return dealers.filter((d) => dealerBelongsToTerritoryCityDisplayName(d, city.name));
}

function cityTasks(tasks: MatrixTaskWithContext[], city: TerritoryCitySummary, dealers: DealerRow[]): MatrixTaskWithContext[] {
  const ids = new Set(cityDealers(dealers, city).map((d) => d.id));
  return tasks.filter((t) => ids.has(t.dealerId));
}

function cityRisks(risks: TerritoryRiskItem[], city: TerritoryCitySummary): TerritoryRiskItem[] {
  return risks.filter((r) => r.city === city.name);
}

function kpiCardClass(active: boolean) {
  return cn(
    "group relative w-full rounded-xl border bg-card p-3 text-left shadow-xs transition-colors",
    "border-[#E3E6F3] hover:border-primary/50 hover:bg-[#EEEFF6]/80",
    active && "border-primary/60 ring-1 ring-primary/25",
  );
}

export function TerritoryCardCockpitFactual({
  livePack,
  mergedState,
}: {
  livePack: TerritoryCardLivePack;
  mergedState: ActualizationState;
}) {
  const isMobile = useIsMobile();
  const [detail, setDetail] = useState<TerritoryCockpitDetail | null>(null);
  const [citySort, setCitySort] = useState<CitySortKey>("dealers");
  const [cityChip, setCityChip] = useState<CityChip>("all");
  const [cityListExpanded, setCityListExpanded] = useState(false);

  const summary = livePack.summary;
  const dealers = livePack.cockpitDealers;
  const tasksAll = livePack.cockpitPersistedTasksAll;
  const controlRows = livePack.cockpitShowcaseControlDetails;
  const risks = livePack.risks;
  const cities = livePack.cities;
  const planLines = livePack.planLines;

  const citiesEnriched = useMemo(() => {
    const rows = cities.map((c) => ({
      c,
      attention: attentionForCity(c, risks),
      hasTop: cityHasTopClient(dealers, c),
    }));
    const sorted = [...rows].sort((a, b) => {
      if (citySort === "dealers") return b.c.dealersCount - a.c.dealersCount || a.c.name.localeCompare(b.c.name, "ru");
      if (citySort === "tradePoints") return b.c.tradePointsCount - a.c.tradePointsCount || a.c.name.localeCompare(b.c.name, "ru");
      if (citySort === "tasks") return b.c.tasksCount - a.c.tasksCount || a.c.name.localeCompare(b.c.name, "ru");
      return b.attention - a.attention || a.c.name.localeCompare(b.c.name, "ru");
    });
    const filtered = sorted.filter(({ c, hasTop }) => {
      if (cityChip === "tasks") return c.tasksCount > 0;
      if (cityChip === "noTp") return c.tradePointsCount === 0;
      if (cityChip === "withTp") return c.tradePointsCount > 0;
      if (cityChip === "top") return hasTop;
      return true;
    });
    return filtered;
  }, [cities, citySort, cityChip, dealers, risks]);

  const visibleCities = isMobile && !cityListExpanded ? citiesEnriched.slice(0, 8) : citiesEnriched;

  const activeClients = summary.dealersActive;
  const activeTradePoints = summary.tradePointsTotal;

  const structureMetrics = useMemo(() => {
    const m = Math.max(activeClients, activeTradePoints, 1);
    const ratio = activeClients > 0 ? activeTradePoints / activeClients : 0;
    const ratioLabel =
      activeClients > 0
        ? ratio.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "—";
    return { m, ratioLabel };
  }, [activeClients, activeTradePoints]);

  const topCitiesBar = useMemo(() => {
    const named = cities
      .filter((c) => c.name !== "Без города" && c.dealersCount > 0)
      .sort((a, b) => b.dealersCount - a.dealersCount || a.name.localeCompare(b.name, "ru"));
    const top = named.slice(0, 5);
    const maxD = top.reduce((mx, c) => Math.max(mx, c.dealersCount), 0) || 1;
    const noCity = cities.find((c) => c.name === "Без города" && c.dealersCount > 0);
    return { top, maxD, showChart: named.length >= 2, noCity };
  }, [cities]);

  const insightMetrics = useMemo(() => {
    const citiesNoTp = cities.filter((c) => c.dealersCount > 0 && c.tradePointsCount === 0).length;
    const citiesWithTp = cities.filter((c) => c.tradePointsCount > 0).length;
    return { citiesNoTp, citiesWithTp };
  }, [cities]);

  const maxDealersInList = useMemo(
    () => cities.reduce((mx, c) => Math.max(mx, c.dealersCount), 0) || 1,
    [cities],
  );

  const openTasksCount = summary.tasksOpen;
  const controlTpCount = livePack.factualShowcaseMatrixControlledTpCount;

  const detailTitle = (d: TerritoryCockpitDetail | null): string => {
    if (!d) return "";
    if (d.kind === "kpi-clients") return "Активные клиенты";
    if (d.kind === "kpi-trade-points") return "Активные торговые точки";
    if (d.kind === "kpi-showcase-tasks") return "Задачи по витрине";
    if (d.kind === "kpi-showcase-control") return "Контроль витрины и матрицы";
    if (d.kind === "kpi-attention") return "Зоны внимания";
    const city = cities.find((x) => x.id === d.cityId);
    return city ? `Город: ${city.name}` : "Город";
  };

  const renderDetailBody = (d: TerritoryCockpitDetail) => {
    if (d.kind === "kpi-clients") {
      const list = dealers.filter((row) => row.status === "активный");
      return (
        <ul className="space-y-2 text-sm">
          {list.map((row) => (
            <li key={row.id} className="rounded-lg border border-[#E3E6F3] bg-[#FFFFFF] p-3">
              <p className="font-medium text-[#222631]">{row.name}</p>
              <p className="text-xs text-[#8F96B0]">
                {row.city?.trim() || "Без города"}
                {getDealerManagerDisplay(row) ? ` · Менеджер: ${getDealerManagerDisplay(row)}` : ""}
                {getDealerRopDisplay(row) ? ` · РОП: ${getDealerRopDisplay(row)}` : ""}
              </p>
              <Button asChild variant="outline" size="sm" className="mt-2 h-8 border-[#E3E6F3] text-xs font-semibold">
                <Link href={`/dealers/${row.id}`}>Открыть клиента</Link>
              </Button>
            </li>
          ))}
          {list.length === 0 ? <p className="text-sm text-[#8F96B0]">Нет активных клиентов в выборке.</p> : null}
        </ul>
      );
    }
    if (d.kind === "kpi-trade-points") {
      const lines: { tp: DealerRow["tradePoints"][number]; dealer: DealerRow }[] = [];
      for (const dealer of dealers) {
        for (const tp of dealer.tradePoints) {
          lines.push({ tp, dealer });
        }
      }
      return (
        <ul className="space-y-2 text-sm">
          {lines.map(({ tp, dealer }) => {
            const hint = showcaseHintForTp(tp.id, mergedState);
            return (
              <li key={`${dealer.id}-${tp.id}`} className="rounded-lg border border-[#E3E6F3] bg-[#FFFFFF] p-3">
                <p className="font-medium text-[#222631]">{tp.name}</p>
                <p className="text-xs text-[#8F96B0]">
                  {dealer.name} · {tp.city?.trim() && tp.city.trim() !== "—" ? tp.city.trim() : "Без города"}
                </p>
                <p className="text-xs text-[#222631]">Статус точки: {tp.status}</p>
                {hint ? <p className="text-xs text-[#8F96B0]">{hint}</p> : null}
                <Button asChild variant="outline" size="sm" className="mt-2 h-8 border-[#E3E6F3] text-xs font-semibold">
                  <Link href={`/dealers/${dealer.id}/trade-points/${tp.id}`}>Открыть точку</Link>
                </Button>
              </li>
            );
          })}
          {lines.length === 0 ? <p className="text-sm text-[#8F96B0]">Нет торговых точек в выборке.</p> : null}
        </ul>
      );
    }
    if (d.kind === "kpi-showcase-tasks") {
      const open = tasksAll.filter((t) => t.status !== "done");
      if (open.length === 0) {
        return <p className="text-sm text-[#8F96B0]">Нет актуальных задач по витрине</p>;
      }
      return (
        <ul className="space-y-2 text-sm">
          {open.map((t) => (
            <li key={t.taskId} className="rounded-lg border border-[#E3E6F3] bg-[#FFFFFF] p-3">
              <p className="font-medium text-[#222631]">{t.title}</p>
              <p className="text-xs text-[#8F96B0]">{t.dealerName}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px]">
                  {MATRIX_TASK_TYPE_LABEL[t.type]}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {MATRIX_TASK_STATUS_LABEL[t.status]}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {MATRIX_TASK_PRIORITY_LABEL[t.priority]}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-[#8F96B0]">Срок: {t.dueDate}</p>
              <Button asChild variant="outline" size="sm" className="mt-2 h-8 text-xs font-semibold">
                <Link href="/tasks">К задачам по витрине</Link>
              </Button>
            </li>
          ))}
        </ul>
      );
    }
    if (d.kind === "kpi-showcase-control") {
      if (controlRows.length === 0) {
        return <p className="text-sm text-[#8F96B0]">Нет сохранённого контроля витрины</p>;
      }
      return (
        <ul className="space-y-2 text-sm">
          {controlRows.map((r) => (
            <li key={`${r.dealerId}-${r.tradePointId}-${r.source}`} className="rounded-lg border border-[#E3E6F3] bg-[#FFFFFF] p-3">
              <p className="font-medium text-[#222631]">{r.tpName}</p>
              <p className="text-xs text-[#8F96B0]">
                {r.dealerName} · {r.city} · {r.source === "actualization" ? "Актуализация" : "Матрица (localStorage)"}
              </p>
              {(r.updatedAt || r.updatedByName) && (
                <p className="text-xs text-[#222631]">
                  {r.updatedAt ? `Обновлено: ${r.updatedAt}` : ""}
                  {r.updatedByName ? ` · ${r.updatedByName}` : ""}
                </p>
              )}
              <Button asChild variant="outline" size="sm" className="mt-2 h-8 text-xs font-semibold">
                <Link href={`/dealers/${r.dealerId}/trade-points/${r.tradePointId}`}>Открыть точку</Link>
              </Button>
            </li>
          ))}
        </ul>
      );
    }
    if (d.kind === "kpi-attention") {
      if (risks.length === 0) {
        return <p className="text-sm text-[#8F96B0]">Нет сохранённых зон внимания</p>;
      }
      return (
        <ul className="space-y-2 text-sm">
          {risks.map((r) => (
            <li key={r.id} className="rounded-lg border border-[#E3E6F3] bg-[#FFFFFF] p-3">
              <p className="font-medium text-[#222631]">{r.title}</p>
              <p className="text-xs text-[#8F96B0]">{r.city}</p>
              <p className="mt-1 text-xs text-[#222631]">{r.reason}</p>
              <p className="text-xs text-[#8F96B0]">{r.nextAction}</p>
            </li>
          ))}
        </ul>
      );
    }
    const city = cities.find((x) => x.id === d.cityId);
    if (!city) return <p className="text-sm text-[#8F96B0]">Город не найден</p>;
    const cd = cityDealers(dealers, city);
    const ct = cityTasks(tasksAll, city, dealers);
    const cr = cityRisks(risks, city);
    const tps: { tp: DealerRow["tradePoints"][number]; dealer: DealerRow }[] = [];
    for (const dealer of cd) {
      for (const tp of dealer.tradePoints) tps.push({ tp, dealer });
    }
    return (
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 border-[#E3E6F3] text-xs font-semibold">
            <Link href="/dealer-base">Клиентская база</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 border-[#E3E6F3] text-xs font-semibold">
            <Link href="/trade-points">Торговые точки</Link>
          </Button>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8F96B0]">Клиенты</p>
          <ul className="mt-2 space-y-2">
            {cd.map((row) => (
              <li key={row.id} className="rounded-lg border border-[#E3E6F3] p-2">
                <span className="font-medium text-[#222631]">{row.name}</span>
                <Button asChild variant="ghost" className="ml-2 h-auto p-0 text-xs font-semibold text-primary hover:bg-transparent">
                  <Link href={`/dealers/${row.id}`}>Открыть</Link>
                </Button>
              </li>
            ))}
            {cd.length === 0 ? <p className="text-xs text-[#8F96B0]">Нет клиентов</p> : null}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8F96B0]">Торговые точки</p>
          <ul className="mt-2 space-y-2">
            {tps.map(({ tp, dealer }) => (
              <li key={tp.id} className="rounded-lg border border-[#E3E6F3] p-2">
                <span className="font-medium text-[#222631]">{tp.name}</span>
                <span className="text-xs text-[#8F96B0]"> · {dealer.name}</span>
                <Button asChild variant="ghost" className="ml-2 h-auto p-0 text-xs font-semibold text-primary hover:bg-transparent">
                  <Link href={`/dealers/${dealer.id}/trade-points/${tp.id}`}>Открыть</Link>
                </Button>
              </li>
            ))}
            {tps.length === 0 ? <p className="text-xs text-[#8F96B0]">Нет точек</p> : null}
          </ul>
        </div>
        {ct.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8F96B0]">Задачи по витрине</p>
            <ul className="mt-2 space-y-1 text-xs">
              {ct.map((t) => (
                <li key={t.taskId} className="text-[#222631]">
                  {t.title} · {t.dealerName}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {cr.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#8F96B0]">Зоны внимания</p>
            <ul className="mt-2 space-y-1 text-xs">
              {cr.map((r) => (
                <li key={r.id} className="text-[#222631]">
                  {r.title}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  };

  const openDetail = (next: TerritoryCockpitDetail) => {
    setDetail(next);
  };

  const closeDetail = () => setDetail(null);

  const detailBody = detail ? renderDetailBody(detail) : null;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="min-w-0 max-w-full space-y-4 overflow-x-hidden pb-32 lg:flex lg:items-start lg:gap-6 lg:pb-8"
        data-testid="page-territory-card"
      >
        <div className="min-w-0 flex-1 space-y-4" data-testid="section-territory-cockpit">
          <Card className="border-[#E3E6F3] shadow-sm">
            <CardContent className="space-y-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-primary">
                    <MapPinned className="h-5 w-5 shrink-0" aria-hidden />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8F96B0]">
                      Территория «{summary.territoryLabel}»
                    </span>
                  </div>
                  <h1 className="text-xl font-semibold tracking-tight text-[#222631] sm:text-2xl">Карточка территории</h1>
                  <p className="text-xs text-[#8F96B0]">Активная база, без архива и демо</p>
                  <p className="text-[11px] font-medium text-primary" data-testid="text-territory-data-source">
                    Источник: актуальная активная база
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E3E6F3] text-[#8F96B0] hover:bg-[#EEEFF6]"
                      aria-label="Подробнее о данных"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs" side="bottom">
                    Показатели и списки строятся только по merge актуализации команды. Задачи витрины — записи плана в
                    sessionStorage; контроль витрины/матрицы — сохранённые формы и localStorage; зоны внимания — просрочки
                    плана и открытые задачи матрицы из актуализации. Без синтетики каталога.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" className="h-9 border-[#E3E6F3] font-semibold text-[#222631]">
                  <Link href="/main">К главному</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-9 border-[#E3E6F3] font-semibold text-[#222631]" data-testid="button-territory-open-dealers">
                  <Link href="/dealer-base">К клиентам</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-9 border-[#E3E6F3] font-semibold text-[#222631]" data-testid="button-territory-open-client-map">
                  <Link href="/client-map">К карте</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-9 border-[#E3E6F3] font-semibold text-[#222631]" data-testid="button-territory-open-analytics">
                  <Link href="/analytics">К аналитике</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#8F96B0]">Сводка</p>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
              <button
                type="button"
                className={kpiCardClass(detail?.kind === "kpi-clients")}
                data-testid="card-territory-kpi-active-clients"
                onClick={() => openDetail({ kind: "kpi-clients" })}
              >
                <p className="text-[11px] font-medium text-[#8F96B0]">Активные клиенты</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[#222631]">{summary.dealersActive}</p>
                <ChevronRight className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8F96B0] opacity-0 group-hover:opacity-100" />
              </button>
              <button
                type="button"
                className={kpiCardClass(detail?.kind === "kpi-trade-points")}
                data-testid="card-territory-kpi-active-trade-points"
                onClick={() => openDetail({ kind: "kpi-trade-points" })}
              >
                <p className="text-[11px] font-medium text-[#8F96B0]">Активные ТТ</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[#222631]">{summary.tradePointsTotal}</p>
                <ChevronRight className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8F96B0] opacity-0 group-hover:opacity-100" />
              </button>
              <button
                type="button"
                className={kpiCardClass(detail?.kind === "kpi-showcase-tasks")}
                data-testid="card-territory-kpi-showcase-tasks"
                onClick={() => openDetail({ kind: "kpi-showcase-tasks" })}
              >
                <p className="text-[11px] font-medium text-[#8F96B0]">Задачи витрины</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[#222631]">{summary.tasksOpen}</p>
                <p className="text-[10px] text-[#8F96B0]">{summary.tasksOpen === 0 ? "Нет задач" : "Открытые записи"}</p>
              </button>
              <button
                type="button"
                className={kpiCardClass(detail?.kind === "kpi-showcase-control")}
                data-testid="card-territory-kpi-showcase-control"
                onClick={() => openDetail({ kind: "kpi-showcase-control" })}
              >
                <p className="text-[11px] font-medium text-[#8F96B0]">Контроль витрины</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[#222631]">{livePack.factualShowcaseMatrixControlledTpCount}</p>
                <p className="text-[10px] text-[#8F96B0]">
                  {livePack.factualShowcaseMatrixControlledTpCount === 0 ? "Нет данных" : "ТТ с сохранением"}
                </p>
              </button>
              <button
                type="button"
                className={cn(kpiCardClass(detail?.kind === "kpi-attention"), "col-span-2 lg:col-span-1")}
                data-testid="card-territory-kpi-attention-zones"
                onClick={() => openDetail({ kind: "kpi-attention" })}
              >
                <p className="text-[11px] font-medium text-[#8F96B0]">Зоны внимания</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[#222631]">{risks.length}</p>
                <p className="text-[10px] text-[#8F96B0]">{risks.length === 0 ? "Нет зон внимания" : "По задачам"}</p>
              </button>
            </div>
          </div>

          <div className={cn("grid gap-3", topCitiesBar.showChart && "lg:grid-cols-2")}>
            <Card className="border-[#E3E6F3] shadow-sm" data-testid="section-territory-structure-infographic">
              <CardContent className="space-y-3 p-3 sm:p-4">
                <h2 className="text-sm font-semibold text-[#222631]">Структура территории</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#222631]">
                  <span>
                    <span className="font-semibold tabular-nums">{activeClients}</span> клиентов
                  </span>
                  <span>
                    <span className="font-semibold tabular-nums">{activeTradePoints}</span> торговых точек
                  </span>
                </div>
                <p className="text-xs text-[#8F96B0]" data-testid="text-territory-trade-point-ratio">
                  {structureMetrics.ratioLabel === "—"
                    ? "ТТ на клиента: нет активных клиентов для расчёта"
                    : `${structureMetrics.ratioLabel} ТТ на клиента`}
                </p>
                <div className="space-y-2">
                  <div>
                    <div className="mb-0.5 flex justify-between text-[11px] text-[#8F96B0]">
                      <span>Клиенты</span>
                      <span className="tabular-nums text-[#222631]">{activeClients}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#EEEFF6]">
                      <div
                        className="h-full rounded-full bg-[#9ACA3C] transition-colors hover:bg-[#86B832]"
                        style={{ width: `${(activeClients / structureMetrics.m) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-0.5 flex justify-between text-[11px] text-[#8F96B0]">
                      <span>Торговые точки</span>
                      <span className="tabular-nums text-[#222631]">{activeTradePoints}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#EEEFF6]">
                      <div
                        className="h-full rounded-full bg-[#9ACA3C]/85 transition-colors hover:bg-[#86B832]"
                        style={{ width: `${(activeTradePoints / structureMetrics.m) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] leading-snug text-[#8F96B0]">
                  {activeTradePoints < activeClients
                    ? "Есть клиенты без торговых точек"
                    : "Покрытие торговыми точками заполнено"}
                </p>
              </CardContent>
            </Card>

            {topCitiesBar.showChart ? (
              <Card className="border-[#E3E6F3] shadow-sm" data-testid="section-territory-top-cities-chart">
                <CardContent className="space-y-2 p-3 sm:p-4">
                  <h2 className="text-sm font-semibold text-[#222631]">Топ городов по клиентам</h2>
                  <ul className="space-y-2">
                    {topCitiesBar.top.map((c) => {
                      const w = Math.round((c.dealersCount / topCitiesBar.maxD) * 100);
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            className="flex w-full min-w-0 items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm text-[#222631] hover:bg-[#EEEFF6]/80"
                            data-testid={`row-territory-top-city-${c.id}`}
                            onClick={() => openDetail({ kind: "city", cityId: c.id })}
                          >
                            <span className="w-[7.5rem] shrink-0 truncate font-medium sm:w-36">{c.name}</span>
                            <span className="min-w-0 flex-1">
                              <span className="flex h-2 overflow-hidden rounded-full bg-[#EEEFF6]">
                                <span
                                  className="rounded-full bg-[#9ACA3C] transition-colors hover:bg-[#86B832]"
                                  style={{ width: `${w}%` }}
                                />
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums text-xs text-[#222631]">
                              {c.dealersCount}
                              <span className="text-[#8F96B0]"> · ТТ {c.tradePointsCount}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {topCitiesBar.noCity ? (
                    <button
                      type="button"
                      className="flex w-full items-center justify-between border-t border-[#E3E6F3] pt-2 text-left text-xs text-[#8F96B0] hover:text-[#222631]"
                      data-testid={`row-territory-top-city-${topCitiesBar.noCity.id}`}
                      onClick={() => openDetail({ kind: "city", cityId: topCitiesBar.noCity!.id })}
                    >
                      <span className="truncate font-medium text-[#222631]">Без города</span>
                      <span className="tabular-nums">
                        {topCitiesBar.noCity.dealersCount} клиентов · ТТ {topCitiesBar.noCity.tradePointsCount}
                      </span>
                    </button>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <section className="space-y-2" data-testid="section-territory-insights">
            <h2 className="text-sm font-semibold text-[#222631]">Что проверить</h2>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <button
                type="button"
                className={cn(
                  "rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] p-3 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-[#EEEFF6]/60",
                  cityChip === "noTp" && "border-primary/50 ring-1 ring-primary/20",
                )}
                data-testid="card-territory-insight-without-trade-points"
                onClick={() => {
                  setCityChip("noTp");
                  setCitySort("dealers");
                }}
              >
                <p className="text-[11px] font-medium text-[#8F96B0]">Клиенты без ТТ</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#222631]">{insightMetrics.citiesNoTp}</p>
                <p className="mt-1 text-[10px] text-[#8F96B0]">
                  {insightMetrics.citiesNoTp === 0 ? "Нет городов только с клиентами без ТТ" : "городов с клиентами и без точек"}
                </p>
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] p-3 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-[#EEEFF6]/60",
                  cityChip === "withTp" && "border-primary/50 ring-1 ring-primary/20",
                )}
                data-testid="card-territory-insight-cities-with-trade-points"
                onClick={() => {
                  setCityChip("withTp");
                  setCitySort("tradePoints");
                }}
              >
                <p className="text-[11px] font-medium text-[#8F96B0]">Города с ТТ</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#222631]">{insightMetrics.citiesWithTp}</p>
                <p className="mt-1 text-[10px] text-[#8F96B0]">
                  {insightMetrics.citiesWithTp === 0 ? "Нет городов с торговыми точками" : "населённых пунктов с точками"}
                </p>
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] p-3 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-[#EEEFF6]/60",
                  detail?.kind === "kpi-showcase-tasks" && "border-primary/50 ring-1 ring-primary/20",
                )}
                data-testid="card-territory-insight-with-tasks"
                onClick={() => openDetail({ kind: "kpi-showcase-tasks" })}
              >
                <p className="text-[11px] font-medium text-[#8F96B0]">Открытые задачи</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#222631]">{openTasksCount}</p>
                <p className="mt-1 text-[10px] text-[#8F96B0]">
                  {openTasksCount === 0 ? "Нет открытых задач" : "сохранённые в актуализации"}
                </p>
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] p-3 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-[#EEEFF6]/60",
                  detail?.kind === "kpi-showcase-control" && "border-primary/50 ring-1 ring-primary/20",
                )}
                data-testid="card-territory-insight-showcase-control"
                onClick={() => openDetail({ kind: "kpi-showcase-control" })}
              >
                <p className="text-[11px] font-medium text-[#8F96B0]">Контроль витрины</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[#222631]">{controlTpCount}</p>
                <p className="mt-1 text-[10px] text-[#8F96B0]">
                  {controlTpCount === 0 ? "Нет сохранённого контроля" : "ТТ с сохранением"}
                </p>
              </button>
            </div>
          </section>

          {planLines.length === 0 ? (
            <Card className="border-dashed border-[#E3E6F3] bg-[#EEEFF6]/40">
              <CardContent className="space-y-1 p-3 text-xs text-[#8F96B0]">
                <p className="font-medium text-[#222631]">План-факт пока не подключён</p>
                <p>Нет данных из учётных систем.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2 lg:grid-cols-3">
              {planLines.map((line) => (
                <Card key={line.key} className="border-[#E3E6F3]" data-testid={planCardTestId(line.key)}>
                  <CardContent className="p-3 text-xs">
                    <p className="font-semibold text-[#222631]">{line.label}</p>
                    <p className="text-[#8F96B0]">План / факт в штуках или ₽</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <section className="space-y-2" data-testid="section-territory-city-list">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#222631]">Города и населённые пункты</h2>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={citySort === "dealers" ? "default" : "outline"}
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setCitySort("dealers")}
                >
                  Клиенты
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={citySort === "tradePoints" ? "default" : "outline"}
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setCitySort("tradePoints")}
                >
                  ТТ
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={citySort === "tasks" ? "default" : "outline"}
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setCitySort("tasks")}
                >
                  Задачи
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={citySort === "attention" ? "default" : "outline"}
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setCitySort("attention")}
                >
                  Внимание
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-[#8F96B0]">
              Полный список по выбранным фильтрам и сортировке. Задачи в строке — только записи плана витрины (sessionStorage) по
              клиентам города.
            </p>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                variant={cityChip === "all" ? "default" : "outline"}
                className="h-7 rounded-full px-3 text-[11px]"
                data-testid="button-territory-city-filter-all"
                onClick={() => setCityChip("all")}
              >
                Все
              </Button>
              <Button
                type="button"
                size="sm"
                variant={cityChip === "tasks" ? "default" : "outline"}
                className="h-7 rounded-full px-3 text-[11px]"
                data-testid="button-territory-city-filter-with-tasks"
                onClick={() => setCityChip("tasks")}
              >
                С задачами
              </Button>
              <Button
                type="button"
                size="sm"
                variant={cityChip === "noTp" ? "default" : "outline"}
                className="h-7 rounded-full px-3 text-[11px]"
                data-testid="button-territory-city-filter-without-trade-points"
                onClick={() => setCityChip("noTp")}
              >
                Без ТТ
              </Button>
              <Button
                type="button"
                size="sm"
                variant={cityChip === "top" ? "default" : "outline"}
                className="h-7 rounded-full px-3 text-[11px]"
                data-testid="button-territory-city-filter-top-clients"
                onClick={() => setCityChip("top")}
              >
                Топ клиентов
              </Button>
            </div>
            <div className="overflow-hidden rounded-xl border border-[#E3E6F3] bg-[#FFFFFF]">
              {visibleCities.length === 0 ? (
                <p className="p-4 text-sm text-[#8F96B0]">Нет городов по выбранным фильтрам.</p>
              ) : (
                visibleCities.map(({ c, attention }) => {
                  const share = maxDealersInList > 0 ? Math.round((c.dealersCount / maxDealersInList) * 100) : 0;
                  const rowActive = detail?.kind === "city" && detail.cityId === c.id;
                  return (
                    <div key={c.id} className="border-b border-[#E3E6F3] last:border-b-0" data-testid={`row-territory-city-${c.id}`}>
                      <button
                        type="button"
                        className={cn(
                          "group flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[#EEEFF6]/60",
                          rowActive && "bg-[#EEEFF6]/90",
                        )}
                        data-testid={`button-territory-city-open-${c.id}`}
                        aria-label={`Открыть город ${c.name}`}
                        onClick={() => openDetail({ kind: "city", cityId: c.id })}
                      >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#222631]">{c.name}</p>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#EEEFF6]">
                          <div
                            className="h-full rounded-full bg-[#9ACA3C]/75 transition-colors group-hover:bg-[#86B832]"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-[#8F96B0]">
                          Клиентов: {c.dealersCount} · ТТ: {c.tradePointsCount}
                          {c.tasksCount > 0 ? ` · Задачи: ${c.tasksCount}` : ""}
                          {attention > 0 ? ` · Внимание: ${attention}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#8F96B0]" aria-hidden />
                    </button>
                    </div>
                  );
                })
              )}
            </div>
            {isMobile && citiesEnriched.length > 8 ? (
              <Button type="button" variant="outline" size="sm" className="w-full border-[#E3E6F3]" onClick={() => setCityListExpanded((v) => !v)}>
                {cityListExpanded ? "Свернуть" : "Показать все"}
              </Button>
            ) : null}
          </section>
        </div>

        {!isMobile && detail ? (
          <aside
            className="sticky top-4 hidden w-full max-w-md shrink-0 rounded-xl border border-[#E3E6F3] bg-[#FFFFFF] shadow-sm lg:block lg:max-w-[420px]"
            data-testid="dialog-territory-detail"
          >
            <div className="flex items-center justify-between border-b border-[#E3E6F3] px-4 py-3">
              <h3 className="text-sm font-semibold text-[#222631]">{detailTitle(detail)}</h3>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={closeDetail}>
                Закрыть
              </Button>
            </div>
            <div className="max-h-[calc(100vh-6rem)] overflow-y-auto p-4">{detailBody}</div>
          </aside>
        ) : null}
      </div>

      <Sheet open={Boolean(isMobile && detail)} onOpenChange={(o) => !o && closeDetail()}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl border-[#E3E6F3] p-0">
          <SheetHeader className="border-b border-[#E3E6F3] px-4 pb-3 pt-4 text-left">
            <SheetTitle className="text-base">{detailTitle(detail)}</SheetTitle>
            <SheetDescription className="sr-only">Детали выбранного блока</SheetDescription>
          </SheetHeader>
          <div className="max-h-[65vh] overflow-y-auto px-4 pb-6 pt-2" data-testid="dialog-territory-detail">
            {detailBody}
          </div>
        </SheetContent>
      </Sheet>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E3E6F3] bg-[#FFFFFF]/95 px-4 py-2 backdrop-blur-sm lg:hidden">
        <div className="mx-auto flex max-w-lg justify-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-9 flex-1 border-[#E3E6F3] font-semibold">
            <Link href="/main">К главному</Link>
          </Button>
          <Button asChild variant="default" size="sm" className="h-9 flex-1 font-semibold">
            <Link href="/dealer-base">К клиентам</Link>
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
