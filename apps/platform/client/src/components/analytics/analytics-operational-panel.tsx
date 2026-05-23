"use client";

import { useCallback, useMemo, useState } from "react";
import { useOptionalClientBaseTeamActualization } from "@/context/client-base-team-actualization-context";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";
import { useReleaseDemoProfile } from "@/hooks/use-release-demo-profile";
import { buildDealerBaseRowsWithActualization } from "@/lib/client-base-actualization-data-merge";
import { shouldUseTeamMergedActualizationPlane } from "@/lib/client-base-management-scope";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getClientCategoryLabel } from "@/lib/client-category";
import { cn } from "@/lib/utils";
import {
  type OperationalAnalyticsTab,
  type OperationalGlobalFilters,
  type OperationalClientShowcaseRow,
  type OperationalShowcaseProfitabilityRow,
  type OperationalHardwareConversionRow,
  type OperationalEquipmentRow,
  type ShowcaseCheckStatus,
  type ShowcaseAttentionZone,
  type HardwareConversionLevel,
  type EquipmentPeriodFilter,
  filterClientShowcaseRows,
  filterShowcaseProfitabilityRows,
  filterHardwareRows,
  filterEquipmentRows,
  kpiForClientShowcase,
  kpiForProfitabilityRows,
  kpiHardware,
  kpiEquipment,
  OPERATIONAL_DEFAULT_GLOBAL_FILTERS,
  buildOperationalAnalyticsRowSlicesFromDealers,
  type OperationalAnalyticsRowSlices,
} from "@/lib/analytics-operational-data";
import { DEALER_BASE_ROWS } from "@/lib/dealer-base-mock-data";
import { formatCompactRub, formatPercent, formatUnits } from "@/lib/sales-manager-kpi-data";
import { EquipmentContractDialog } from "@/components/analytics/equipment-contract-dialog";
import { OperationalHeaderKpi, type OperationalStripMetric } from "@/components/analytics/operational-kpi-strip";
import { OperationalFiltersBar } from "@/components/analytics/operational-filters-bar";

function statusLabel(s: ShowcaseCheckStatus | "all"): string {
  if (s === "all") return "Все";
  if (s === "verified") return "Проверено";
  if (s === "needs_check") return "Требует проверки";
  return "Нет данных";
}

function attentionLabel(z: ShowcaseAttentionZone | "all"): string {
  if (z === "all") return "Все";
  if (z === "high_profit") return "Высокая рентабельность";
  if (z === "low_profit") return "Низкая рентабельность";
  if (z === "many_competitors") return "Много конкурентов";
  return "Нет продаж по витрине";
}

function convLabel(c: HardwareConversionLevel | "all"): string {
  if (c === "all") return "Все";
  if (c === "high") return "Высокая";
  if (c === "medium") return "Средняя";
  if (c === "low") return "Низкая";
  return "Нет конверсии";
}

function showcaseStatusBadgeClass(s: ShowcaseCheckStatus) {
  if (s === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (s === "needs_check") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-border bg-muted/60 text-muted-foreground";
}

function firstShowcaseProductId(row: OperationalClientShowcaseRow): string | null {
  const m = row.mkModels[0] ?? row.vhModels[0] ?? row.hardwareModels[0];
  return m?.productId ?? null;
}

function ModelChips({ models }: { models: { productId: string; label: string }[] }) {
  if (models.length === 0) {
    return (
      <span className="text-xs italic text-muted-foreground" title="Нет связанных моделей в выборке">
        Нет связанных моделей
      </span>
    );
  }
  const visible = 3;
  const shown = models.slice(0, visible);
  return (
    <div className="flex max-w-full flex-wrap gap-1">
      {shown.map((m) => (
        <Button key={m.productId} asChild variant="secondary" size="sm" className="h-7 max-w-[9.5rem] truncate px-2 text-xs font-medium">
          <Link href={`/catalog/${m.productId}`} title={m.label} data-testid={`button-operational-open-product-${m.productId}`}>
            {m.label}
          </Link>
        </Button>
      ))}
      {models.length > visible ? <span className="self-center text-xs text-muted-foreground">+{models.length - visible}</span> : null}
    </div>
  );
}

function OperationalEmptyResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/15 px-4 py-10 text-center" data-testid="empty-operational-results">
      <p className="text-base font-semibold text-foreground">Ничего не найдено</p>
      <p className="max-w-md text-sm text-muted-foreground">Попробуйте изменить фильтры или очистить поиск.</p>
      <Button type="button" variant="default" size="sm" className="font-semibold" onClick={onReset}>
        Сбросить фильтры
      </Button>
    </div>
  );
}

function PartnerTableDesktop({ rows }: { rows: OperationalClientShowcaseRow[] }) {
  return (
    <Card className="hidden overflow-hidden border-border/80 shadow-xs sm:block">
      <CardContent className="p-0">
        <div className="max-h-[min(70vh,560px)] overflow-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 shadow-sm backdrop-blur-sm">
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="whitespace-nowrap px-3 py-2.5">Клиент</th>
                <th className="whitespace-nowrap px-3 py-2.5">Город</th>
                <th className="whitespace-nowrap px-3 py-2.5">Категория</th>
                <th className="whitespace-nowrap px-3 py-2.5">Статус</th>
                <th className="px-3 py-2.5">МК</th>
                <th className="px-3 py-2.5">ВХ</th>
                <th className="whitespace-nowrap px-3 py-2.5">Полотна</th>
                <th className="whitespace-nowrap px-3 py-2.5">Проверка</th>
                <th className="whitespace-nowrap px-3 py-2.5">Выставлено</th>
                <th className="whitespace-nowrap px-3 py-2.5">Продажи</th>
                <th className="whitespace-nowrap px-3 py-2.5">Витрина</th>
                <th className="whitespace-nowrap px-3 py-2.5">Конверсия</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pid = firstShowcaseProductId(row);
                return (
                  <tr
                    key={row.dealerId}
                    className="border-b border-border/50 transition-colors odd:bg-card even:bg-muted/[0.35] hover:bg-muted/50"
                    data-testid={`row-operational-client-${row.dealerId}`}
                  >
                    <td className="max-w-[11rem] px-3 py-2.5">
                      <span className="line-clamp-2 text-sm font-semibold text-foreground">{row.clientName}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{row.city}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="text-[11px] font-medium">
                        {getClientCategoryLabel(row.clientCategory)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={cn("text-[11px] font-medium", showcaseStatusBadgeClass(row.showcaseCheckStatus))}>
                        {statusLabel(row.showcaseCheckStatus)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <ModelChips models={row.mkModels} />
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <ModelChips models={row.vhModels} />
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-foreground">{row.unitsOnShowcase}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{row.checkDate}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{row.setupDate}</td>
                    <td className="px-3 py-2.5 tabular-nums text-foreground">{row.totalSales}</td>
                    <td className="px-3 py-2.5 tabular-nums text-foreground">{row.showcaseSales}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex min-w-[5.5rem] flex-col gap-1">
                        <span className="text-xs font-semibold tabular-nums text-foreground">{formatPercent(row.conversionPercent)}</span>
                        <Progress value={Math.min(100, row.conversionPercent)} className="h-1.5" />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button asChild size="sm" variant="outline" className="h-8 min-h-8 px-2.5 text-xs font-semibold" data-testid={`button-operational-open-dealer-${row.dealerId}`}>
                          <Link href={`/dealers/${row.dealerId}`}>Клиент</Link>
                        </Button>
                        {pid ? (
                          <Button asChild size="sm" variant="secondary" className="h-8 min-h-8 px-2.5 text-xs font-semibold">
                            <Link href={`/catalog/${pid}`} data-testid={`button-operational-open-product-${pid}`}>
                              Товар
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PartnerCardsMobile({ rows }: { rows: OperationalClientShowcaseRow[] }) {
  return (
    <div className="space-y-3 sm:hidden">
      {rows.map((row) => {
        const pid = firstShowcaseProductId(row);
        return (
          <Card key={row.dealerId} className="border-border/80 shadow-xs ring-1 ring-black/[0.02]" data-testid={`row-operational-client-${row.dealerId}`}>
            <CardHeader className="space-y-2 border-b border-border/50 pb-3 pt-4">
              <CardTitle className="text-base font-semibold leading-snug text-foreground">{row.clientName}</CardTitle>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[11px]">
                  {getClientCategoryLabel(row.clientCategory)}
                </Badge>
                <Badge variant="outline" className="text-[11px] text-muted-foreground">
                  {row.city}
                </Badge>
                <Badge variant="outline" className={cn("text-[11px]", showcaseStatusBadgeClass(row.showcaseCheckStatus))}>
                  {statusLabel(row.showcaseCheckStatus)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pb-4 pt-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Полотна</p>
                  <p className="font-semibold tabular-nums text-foreground">{row.unitsOnShowcase}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Продажи</p>
                  <p className="font-semibold tabular-nums text-foreground">{row.totalSales}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">По витринам</p>
                  <p className="font-semibold tabular-nums text-foreground">{row.showcaseSales}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Конверсия</p>
                  <p className="font-semibold tabular-nums text-foreground">{formatPercent(row.conversionPercent)}</p>
                </div>
              </div>
              <Progress value={Math.min(100, row.conversionPercent)} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">
                Проверка: {row.checkDate} · Выставлено: {row.setupDate}
              </p>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">МК</p>
                <ModelChips models={row.mkModels} />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">ВХ</p>
                <ModelChips models={row.vhModels} />
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <Button asChild className="min-h-11 w-full font-semibold" data-testid={`button-operational-open-dealer-${row.dealerId}`}>
                  <Link href={`/dealers/${row.dealerId}`}>Клиент</Link>
                </Button>
                {pid ? (
                  <Button asChild variant="secondary" className="min-h-11 w-full font-semibold">
                    <Link href={`/catalog/${pid}`} data-testid={`button-operational-open-product-${pid}`}>
                      Товар
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function AnalyticsOperationalPanel() {
  const actx = useClientBaseActualization();
  const teamCtx = useOptionalClientBaseTeamActualization();
  const { profile } = useReleaseDemoProfile();

  const operationalRowSlices = useMemo((): OperationalAnalyticsRowSlices | undefined => {
    if (!actx.enabled || !teamCtx || !shouldUseTeamMergedActualizationPlane(profile)) return undefined;
    const dealers = buildDealerBaseRowsWithActualization(teamCtx.mergedState, profile, { includeArchivedDealers: false });
    return buildOperationalAnalyticsRowSlicesFromDealers(dealers);
  }, [actx.enabled, teamCtx, teamCtx?.mergedState, profile]);

  const equipmentDealerPickerRows = useMemo((): { id: string; name: string }[] => {
    if (operationalRowSlices) {
      const byId = new Map<string, { id: string; name: string }>();
      for (const r of operationalRowSlices.clientShowcase) {
        byId.set(r.dealerId, { id: r.dealerId, name: r.clientName });
      }
      return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, "ru"));
    }
    if (actx.enabled) return [];
    return DEALER_BASE_ROWS.map((d) => ({ id: d.id, name: d.name }));
  }, [operationalRowSlices, actx.enabled]);

  const [globalFilters, setGlobalFilters] = useState<OperationalGlobalFilters>(OPERATIONAL_DEFAULT_GLOBAL_FILTERS);

  const [opTab, setOpTab] = useState<OperationalAnalyticsTab>("top500");
  const [showcaseStatus, setShowcaseStatus] = useState<ShowcaseCheckStatus | "all">("all");
  const [profitAttention, setProfitAttention] = useState<ShowcaseAttentionZone | "all">("all");
  const [hwConv, setHwConv] = useState<HardwareConversionLevel | "all">("all");
  const [hwCompetitors, setHwCompetitors] = useState<boolean | null>(null);
  const [hwOurEq, setHwOurEq] = useState<boolean | null>(null);
  const [eqDealer, setEqDealer] = useState<string | "all">("all");
  const [eqNom, setEqNom] = useState("");
  const [eqPeriod, setEqPeriod] = useState<EquipmentPeriodFilter>("all");
  const [contractId, setContractId] = useState<string | null>(null);

  const resetAll = useCallback(() => {
    setGlobalFilters(OPERATIONAL_DEFAULT_GLOBAL_FILTERS);
    setShowcaseStatus("all");
    setProfitAttention("all");
    setHwConv("all");
    setHwCompetitors(null);
    setHwOurEq(null);
    setEqDealer("all");
    setEqNom("");
    setEqPeriod("all");
  }, []);

  const slices = operationalRowSlices;

  const rowsTop500 = useMemo(
    () => filterClientShowcaseRows("top500", globalFilters, showcaseStatus, slices),
    [globalFilters, showcaseStatus, slices],
  );
  const rows500Plus = useMemo(
    () => filterClientShowcaseRows("fiveHundredPlus", globalFilters, showcaseStatus, slices),
    [globalFilters, showcaseStatus, slices],
  );
  const rowsClub = useMemo(
    () => filterClientShowcaseRows("tandoorClub", globalFilters, showcaseStatus, slices),
    [globalFilters, showcaseStatus, slices],
  );

  const profitRows = useMemo(() => filterShowcaseProfitabilityRows(globalFilters, profitAttention, slices), [globalFilters, profitAttention, slices]);

  const hwRows = useMemo(
    () => filterHardwareRows(globalFilters, hwConv, hwCompetitors, hwOurEq, slices),
    [globalFilters, hwConv, hwCompetitors, hwOurEq, slices],
  );

  const eqRows = useMemo(
    () => filterEquipmentRows(globalFilters, eqDealer, eqNom, eqPeriod, slices),
    [globalFilters, eqDealer, eqNom, eqPeriod, slices],
  );

  const hwKpi = useMemo(() => kpiHardware(hwRows), [hwRows]);
  const eqKpi = useMemo(() => kpiEquipment(eqRows), [eqRows]);

  const tabCounts = useMemo(
    () => ({
      top500: filterClientShowcaseRows("top500", globalFilters, showcaseStatus, slices).length,
      fiveHundredPlus: filterClientShowcaseRows("fiveHundredPlus", globalFilters, showcaseStatus, slices).length,
      tandoorClub: filterClientShowcaseRows("tandoorClub", globalFilters, showcaseStatus, slices).length,
      showcaseProfitability: filterShowcaseProfitabilityRows(globalFilters, profitAttention, slices).length,
      hardwareConversion: filterHardwareRows(globalFilters, hwConv, hwCompetitors, hwOurEq, slices).length,
      equipment: filterEquipmentRows(globalFilters, eqDealer, eqNom, eqPeriod, slices).length,
    }),
    [globalFilters, showcaseStatus, profitAttention, hwConv, hwCompetitors, hwOurEq, eqDealer, eqNom, eqPeriod, slices],
  );

  const activeResultCount = useMemo(() => {
    if (opTab === "top500") return rowsTop500.length;
    if (opTab === "fiveHundredPlus") return rows500Plus.length;
    if (opTab === "tandoorClub") return rowsClub.length;
    if (opTab === "showcaseProfitability") return profitRows.length;
    if (opTab === "hardwareConversion") return hwRows.length;
    return eqRows.length;
  }, [opTab, rowsTop500, rows500Plus, rowsClub, profitRows, hwRows, eqRows]);

  const headerMetrics = useMemo((): [OperationalStripMetric, OperationalStripMetric, OperationalStripMetric, OperationalStripMetric] => {
    if (opTab === "top500" || opTab === "fiveHundredPlus" || opTab === "tandoorClub") {
      const rows = opTab === "top500" ? rowsTop500 : opTab === "fiveHundredPlus" ? rows500Plus : rowsClub;
      const k = kpiForClientShowcase(rows);
      return [
        { label: "Клиентов в выборке", value: String(k.clients) },
        { label: "Моделей на витринах", value: String(k.models) },
        { label: "Продаж по витринам", value: String(k.showcaseSales) },
        { label: "Средняя конверсия", value: formatPercent(k.avgConv) },
      ];
    }
    if (opTab === "showcaseProfitability") {
      const k = kpiForProfitabilityRows(profitRows);
      return [
        { label: "Клиентов в выборке", value: String(k.clients) },
        { label: "Наших витрин (слотов)", value: String(k.showcaseSlots) },
        { label: "Продаж по витринам", value: String(k.showcaseSales) },
        { label: "Средняя доля витрины", value: formatPercent(k.avgShare) },
      ];
    }
    if (opTab === "hardwareConversion") {
      return [
        { label: "Продажи МК", value: formatUnits(hwKpi.mk) },
        { label: "Продажи фурнитуры", value: formatUnits(hwKpi.hw) },
        { label: "Средняя конверсия", value: formatPercent(hwKpi.avg) },
        { label: "Низкая конверсия", value: String(hwKpi.low), hint: "клиентов" },
      ];
    }
    return [
      { label: "Единиц оборудования", value: String(eqKpi.units) },
      { label: "Сумма реализации", value: formatCompactRub(eqKpi.sum) },
      { label: "Клиентов с оборудованием", value: String(eqKpi.clients) },
      { label: "Средняя сумма заказов / мес.", value: formatCompactRub(eqKpi.avgM) },
    ];
  }, [opTab, rowsTop500, rows500Plus, rowsClub, profitRows, hwKpi, eqKpi]);

  const tabTriggerClass =
    "shrink-0 rounded-md border border-transparent px-3 py-2 text-xs font-medium transition-all data-[state=active]:border-primary/40 data-[state=active]:bg-primary/12 data-[state=active]:text-primary data-[state=active]:shadow-sm sm:text-sm";

  return (
    <div className="min-w-0 space-y-5">
      <OperationalHeaderKpi metrics={headerMetrics} />

      <OperationalFiltersBar filters={globalFilters} setFilters={setGlobalFilters} resultCount={activeResultCount} onReset={resetAll} />

      <Tabs value={opTab} onValueChange={(v) => setOpTab(v as OperationalAnalyticsTab)} className="w-full min-w-0" data-testid="tabs-analytics-operational">
        <div className="-mx-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex h-auto min-w-min gap-0.5 rounded-lg border border-border/70 bg-muted/40 p-0.5">
            <TabsTrigger value="top500" className={tabTriggerClass} data-testid="tab-operational-top500">
              ТОП 500 · {tabCounts.top500}
            </TabsTrigger>
            <TabsTrigger value="fiveHundredPlus" className={tabTriggerClass} data-testid="tab-operational-500-plus">
              500+ · {tabCounts.fiveHundredPlus}
            </TabsTrigger>
            <TabsTrigger value="tandoorClub" className={tabTriggerClass} data-testid="tab-operational-tandoor-club">
              Tandoor Club · {tabCounts.tandoorClub}
            </TabsTrigger>
            <TabsTrigger value="showcaseProfitability" className={tabTriggerClass} data-testid="tab-operational-showcase-profitability">
              Рентабельность витрин · {tabCounts.showcaseProfitability}
            </TabsTrigger>
            <TabsTrigger value="hardwareConversion" className={tabTriggerClass} data-testid="tab-operational-hardware-conversion">
              Конверсия фурнитуры · {tabCounts.hardwareConversion}
            </TabsTrigger>
            <TabsTrigger value="equipment" className={tabTriggerClass} data-testid="tab-operational-equipment">
              Оборудование · {tabCounts.equipment}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="top500" className="mt-4 space-y-4 focus-visible:ring-0">
          <div data-testid="section-operational-top500">
            <PartnerSegmentBody rows={rowsTop500} showcaseStatus={showcaseStatus} onShowcaseStatus={setShowcaseStatus} onResetFilters={resetAll} />
          </div>
        </TabsContent>
        <TabsContent value="fiveHundredPlus" className="mt-4 space-y-4 focus-visible:ring-0">
          <div data-testid="section-operational-500-plus">
            <PartnerSegmentBody rows={rows500Plus} showcaseStatus={showcaseStatus} onShowcaseStatus={setShowcaseStatus} onResetFilters={resetAll} />
          </div>
        </TabsContent>
        <TabsContent value="tandoorClub" className="mt-4 space-y-4 focus-visible:ring-0">
          <div data-testid="section-operational-tandoor-club">
            <PartnerSegmentBody rows={rowsClub} showcaseStatus={showcaseStatus} onShowcaseStatus={setShowcaseStatus} onResetFilters={resetAll} />
          </div>
        </TabsContent>

        <TabsContent value="showcaseProfitability" className="mt-4 space-y-4 focus-visible:ring-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[12rem] flex-1">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Зона внимания</span>
              <Select value={profitAttention} onValueChange={(v) => setProfitAttention(v as typeof profitAttention)}>
                <SelectTrigger className="h-10 min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["all", "high_profit", "low_profit", "many_competitors", "no_showcase_sales"] as const).map((z) => (
                    <SelectItem key={z} value={z}>
                      {attentionLabel(z)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button asChild variant="outline" className="h-10 min-h-10 w-full border-border font-semibold sm:w-auto" data-testid="button-operational-open-tasks">
              <Link href="/tasks">К задачам</Link>
            </Button>
          </div>
          {profitRows.length === 0 ? (
            <OperationalEmptyResults onReset={resetAll} />
          ) : (
            <ProfitabilityTables rows={profitRows} />
          )}
        </TabsContent>

        <TabsContent value="hardwareConversion" className="mt-4 space-y-4 focus-visible:ring-0">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/80 shadow-xs ring-1 ring-black/[0.02]" data-testid="card-operational-kpi-hw-mk">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Продажи МК</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-xl font-semibold tabular-nums">{formatUnits(hwKpi.mk)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-xs ring-1 ring-black/[0.02]" data-testid="card-operational-kpi-hw-furn">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Продажи фурнитуры</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-xl font-semibold tabular-nums">{formatUnits(hwKpi.hw)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-xs ring-1 ring-black/[0.02]" data-testid="card-operational-kpi-hw-avg">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Средняя конверсия</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-xl font-semibold tabular-nums">{formatPercent(hwKpi.avg)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-xs ring-1 ring-black/[0.02]" data-testid="card-operational-kpi-hw-low">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Низкая конверсия</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-xl font-semibold tabular-nums">{hwKpi.low}</p>
              </CardContent>
            </Card>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/15 px-3 py-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="min-w-[10rem]">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Конверсия</span>
              <Select value={hwConv} onValueChange={(v) => setHwConv(v as typeof hwConv)}>
                <SelectTrigger className="h-10 min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["all", "high", "medium", "low", "none"] as const).map((c) => (
                    <SelectItem key={c} value={c}>
                      {convLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={hwCompetitors === true} onChange={() => setHwCompetitors(hwCompetitors === true ? null : true)} className="h-4 w-4 rounded border-border" />
              Есть конкуренты
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={hwOurEq === true} onChange={() => setHwOurEq(hwOurEq === true ? null : true)} className="h-4 w-4 rounded border-border" />
              Наше оборудование
            </label>
            <Button asChild variant="outline" className="h-10 min-h-10 border-border font-semibold lg:ml-auto" data-testid="button-operational-open-tasks">
              <Link href="/tasks">К задачам</Link>
            </Button>
          </div>
          {hwRows.length === 0 ? (
            <OperationalEmptyResults onReset={resetAll} />
          ) : (
            <HardwareTables rows={hwRows} />
          )}
        </TabsContent>

        <TabsContent value="equipment" className="mt-4 space-y-4 focus-visible:ring-0">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/80 shadow-xs ring-1 ring-black/[0.02]" data-testid="card-operational-kpi-eq-units">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Единиц оборудования</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-xl font-semibold tabular-nums">{eqKpi.units}</p>
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-xs ring-1 ring-black/[0.02]" data-testid="card-operational-kpi-eq-sum">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Сумма реализации</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-xl font-semibold tabular-nums">{formatCompactRub(eqKpi.sum)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-xs ring-1 ring-black/[0.02]" data-testid="card-operational-kpi-eq-clients">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Клиентов с оборудованием</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-xl font-semibold tabular-nums">{eqKpi.clients}</p>
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-xs ring-1 ring-black/[0.02]" data-testid="card-operational-kpi-eq-avg">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Средняя сумма заказов / мес.</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-xl font-semibold tabular-nums">{formatCompactRub(eqKpi.avgM)}</p>
              </CardContent>
            </Card>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/15 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[10rem] flex-1">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Клиент</span>
              <Select value={eqDealer} onValueChange={(v) => setEqDealer(v as typeof eqDealer)}>
                <SelectTrigger className="h-10 min-h-10">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все клиенты</SelectItem>
                  {equipmentDealerPickerRows.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[10rem] flex-1">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Номенклатура</span>
              <Input value={eqNom} onChange={(e) => setEqNom(e.target.value)} placeholder="Фильтр…" className="h-10 min-h-10" />
            </div>
            <div className="min-w-[10rem]">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Период реализации</span>
              <Select value={eqPeriod} onValueChange={(v) => setEqPeriod(v as EquipmentPeriodFilter)}>
                <SelectTrigger className="h-10 min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="q1">I квартал</SelectItem>
                  <SelectItem value="q2">II квартал</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {eqRows.length === 0 ? (
            <OperationalEmptyResults onReset={resetAll} />
          ) : (
            <EquipmentTables rows={eqRows} onOpenContract={(id) => setContractId(id)} />
          )}
        </TabsContent>
      </Tabs>

      <EquipmentContractDialog open={!!contractId} onOpenChange={(o) => !o && setContractId(null)} equipmentId={contractId} />
    </div>
  );
}

function PartnerSegmentBody({
  rows,
  showcaseStatus,
  onShowcaseStatus,
  onResetFilters,
}: {
  rows: OperationalClientShowcaseRow[];
  showcaseStatus: ShowcaseCheckStatus | "all";
  onShowcaseStatus: (v: ShowcaseCheckStatus | "all") => void;
  onResetFilters: () => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[12rem]">
          <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Статус витрины</span>
          <Select value={showcaseStatus} onValueChange={(v) => onShowcaseStatus(v as typeof showcaseStatus)}>
            <SelectTrigger className="h-10 min-h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["all", "verified", "needs_check", "no_data"] as const).map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {rows.length === 0 ? (
        <OperationalEmptyResults onReset={onResetFilters} />
      ) : (
        <>
          <PartnerTableDesktop rows={rows} />
          <PartnerCardsMobile rows={rows} />
        </>
      )}
    </>
  );
}

function ProfitabilityTables({ rows }: { rows: OperationalShowcaseProfitabilityRow[] }) {
  return (
    <>
      <Card className="hidden overflow-hidden border-border/80 shadow-xs sm:block">
        <CardContent className="p-0" data-testid="section-operational-showcase-profitability">
          <div className="max-h-[min(70vh,560px)] overflow-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 shadow-sm backdrop-blur-sm">
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">Клиент</th>
                  <th className="px-3 py-2.5">Город</th>
                  <th className="px-3 py-2.5">Категория</th>
                  <th className="px-3 py-2.5">Витрины</th>
                  <th className="px-3 py-2.5">Продажи</th>
                  <th className="px-3 py-2.5">Рентабельность</th>
                  <th className="px-3 py-2.5">Доля витрины</th>
                  <th className="px-3 py-2.5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const rowTestId = row.tradePointId ? `row-operational-showcase-${row.dealerId}-${row.tradePointId}` : `row-operational-showcase-${row.dealerId}`;
                  const warn = row.attentionZone === "low_profit" || row.attentionZone === "no_showcase_sales" || row.attentionZone === "many_competitors";
                  return (
                    <tr
                      key={row.rowKey}
                      className={cn(
                        "border-b border-border/50 transition-colors odd:bg-card even:bg-muted/[0.35] hover:bg-muted/50",
                        warn ? "bg-amber-50/40" : "",
                      )}
                      data-testid={rowTestId}
                    >
                      <td className="max-w-[11rem] px-3 py-2.5">
                        <span className="line-clamp-2 text-sm font-semibold text-foreground">{row.clientName}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{row.city}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className="text-[11px]">
                          {getClientCategoryLabel(row.clientCategory)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5 text-xs tabular-nums">
                          <span>
                            <span className="font-semibold text-foreground">{row.ourShowcases}</span>
                            <span className="text-muted-foreground"> наши</span>
                          </span>
                          <span>
                            <span className="font-semibold text-foreground">{row.competitorShowcases}</span>
                            <span className="text-muted-foreground"> конкуренты</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs tabular-nums">
                        <span className="font-medium text-foreground">{row.totalSales}</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="font-medium text-primary">{row.showcaseSales}</span>
                        <span className="text-muted-foreground"> витр.</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-xs font-semibold text-foreground">
                          {row.profitabilityLabel}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex min-w-[6rem] flex-col gap-1">
                          <Progress value={Math.min(100, row.shareShowcasePercent)} className="h-2" />
                          <span className="text-xs tabular-nums text-muted-foreground">{formatPercent(row.shareShowcasePercent)}</span>
                        </div>
                      </td>
                      <td className="space-y-1 px-3 py-2.5 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button asChild size="sm" variant="outline" className="h-8 min-h-8 px-2.5 text-xs font-semibold" data-testid={`button-operational-open-dealer-${row.dealerId}`}>
                            <Link href={`/dealers/${row.dealerId}`}>Клиент</Link>
                          </Button>
                          {row.tradePointId ? (
                            <Button asChild size="sm" variant="secondary" className="h-8 min-h-8 px-2.5 text-xs font-semibold" data-testid={`button-operational-open-trade-point-${row.tradePointId}`}>
                              <Link href={`/dealers/${row.dealerId}/trade-points/${row.tradePointId}`}>ТТ</Link>
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => {
          const rowTestId = row.tradePointId ? `row-operational-showcase-${row.dealerId}-${row.tradePointId}` : `row-operational-showcase-${row.dealerId}`;
          const warn = row.attentionZone === "low_profit" || row.attentionZone === "no_showcase_sales" || row.attentionZone === "many_competitors";
          return (
            <Card key={row.rowKey} className={cn("border-border/80 shadow-xs ring-1 ring-black/[0.02]", warn ? "border-amber-200/80 bg-amber-50/30" : "")} data-testid={rowTestId}>
              <CardHeader className="space-y-2 border-b border-border/50 pb-3 pt-4">
                <CardTitle className="text-base font-semibold leading-snug">{row.clientName}</CardTitle>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[11px]">
                    {getClientCategoryLabel(row.clientCategory)}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] text-muted-foreground">
                    {row.city}
                  </Badge>
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[11px] font-semibold">
                    {row.profitabilityLabel}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pb-4 pt-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Наши / конкуренты</p>
                    <p className="font-semibold tabular-nums text-foreground">
                      {row.ourShowcases} / {row.competitorShowcases}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Продажи всего</p>
                    <p className="font-semibold tabular-nums text-foreground">{row.totalSales}</p>
                  </div>
                  <div className="col-span-2 rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">По витринам</p>
                    <p className="font-semibold tabular-nums text-primary">{row.showcaseSales}</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">Доля витрины</p>
                  <Progress value={Math.min(100, row.shareShowcasePercent)} className="h-2" />
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">{formatPercent(row.shareShowcasePercent)}</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button asChild className="min-h-11 w-full font-semibold" data-testid={`button-operational-open-dealer-${row.dealerId}`}>
                    <Link href={`/dealers/${row.dealerId}`}>Клиент</Link>
                  </Button>
                  {row.tradePointId ? (
                    <Button asChild variant="outline" className="min-h-11 w-full font-semibold" data-testid={`button-operational-open-trade-point-${row.tradePointId}`}>
                      <Link href={`/dealers/${row.dealerId}/trade-points/${row.tradePointId}`}>ТТ</Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function HardwareTables({ rows }: { rows: OperationalHardwareConversionRow[] }) {
  return (
    <>
      <Card className="hidden overflow-hidden border-border/80 shadow-xs sm:block">
        <CardContent className="p-0" data-testid="section-operational-hardware-conversion">
          <div className="max-h-[min(70vh,560px)] overflow-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 shadow-sm backdrop-blur-sm">
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">Клиент</th>
                  <th className="px-3 py-2.5">Город</th>
                  <th className="px-3 py-2.5">Категория</th>
                  <th className="px-3 py-2.5">МК / фурнит.</th>
                  <th className="px-3 py-2.5">Конверсия</th>
                  <th className="px-3 py-2.5">Конкуренты</th>
                  <th className="min-w-[8rem] px-3 py-2.5">Причина</th>
                  <th className="px-3 py-2.5">Склад</th>
                  <th className="px-3 py-2.5">Оборуд.</th>
                  <th className="px-3 py-2.5 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.dealerId} className="border-b border-border/50 odd:bg-card even:bg-muted/[0.35] transition-colors hover:bg-muted/50" data-testid={`row-operational-hardware-${row.dealerId}`}>
                    <td className="max-w-[10rem] px-3 py-2.5">
                      <span className="line-clamp-2 text-sm font-semibold text-foreground">{row.clientName}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{row.city}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="text-[11px]">
                        {getClientCategoryLabel(row.clientCategory)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs tabular-nums">
                      <span className="font-medium">{row.mkSales}</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="font-medium text-primary">{row.hardwareSales}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex min-w-[5rem] flex-col gap-1">
                        <span className="text-xs font-semibold tabular-nums">{formatPercent(row.conversionPercent)}</span>
                        <Progress value={Math.min(100, row.conversionPercent)} className="h-1.5" />
                      </div>
                    </td>
                    <td className="max-w-[11rem] px-3 py-2.5">
                      {row.competitorsSummary ? (
                        <Badge variant="secondary" className="max-w-full whitespace-normal text-left text-[11px] font-normal leading-snug">
                          {row.competitorsSummary}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="max-w-[12rem] px-3 py-2.5 text-xs leading-snug text-muted-foreground">{row.reasonNotWithUs}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={cn("text-[11px]", row.worksUnderStock ? "border-emerald-200 bg-emerald-50" : "")}>
                        {row.worksUnderStock ? "Под склад" : "Нет"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className={cn("text-[11px]", row.ourEquipment ? "border-primary/30 bg-primary/10" : "")}>
                        {row.ourEquipment ? "Наше" : "Нет"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button asChild size="sm" variant="outline" className="h-8 min-h-8 px-2.5 text-xs font-semibold" data-testid={`button-operational-open-dealer-${row.dealerId}`}>
                          <Link href={`/dealers/${row.dealerId}`}>Клиент</Link>
                        </Button>
                        <Button asChild size="sm" variant="secondary" className="h-8 min-h-8 px-2.5 text-xs font-semibold">
                          <Link href="/tasks">Задачи</Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <Card key={row.dealerId} className="border-border/80 shadow-xs ring-1 ring-black/[0.02]" data-testid={`row-operational-hardware-${row.dealerId}`}>
            <CardHeader className="space-y-2 border-b border-border/50 pb-3 pt-4">
              <CardTitle className="text-base font-semibold">{row.clientName}</CardTitle>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[11px]">
                  {getClientCategoryLabel(row.clientCategory)}
                </Badge>
                <Badge variant="outline" className="text-[11px] text-muted-foreground">
                  {row.city}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pb-4 pt-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">МК</p>
                  <p className="font-semibold tabular-nums">{row.mkSales}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Фурнитура</p>
                  <p className="font-semibold tabular-nums text-primary">{row.hardwareSales}</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">Конверсия</p>
                <p className="text-sm font-semibold tabular-nums">{formatPercent(row.conversionPercent)}</p>
                <Progress value={Math.min(100, row.conversionPercent)} className="mt-1 h-2" />
              </div>
              {row.competitorsSummary ? (
                <Badge variant="secondary" className="w-fit text-[11px] font-normal">
                  {row.competitorsSummary}
                </Badge>
              ) : null}
              <p className="text-xs leading-relaxed text-muted-foreground">{row.reasonNotWithUs}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={cn("text-[11px]", row.worksUnderStock ? "border-emerald-200 bg-emerald-50" : "")}>
                  Склад: {row.worksUnderStock ? "да" : "нет"}
                </Badge>
                <Badge variant="outline" className={cn("text-[11px]", row.ourEquipment ? "border-primary/30 bg-primary/10" : "")}>
                  Наше оборуд.: {row.ourEquipment ? "да" : "нет"}
                </Badge>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <Button asChild className="min-h-11 w-full font-semibold" data-testid={`button-operational-open-dealer-${row.dealerId}`}>
                  <Link href={`/dealers/${row.dealerId}`}>Клиент</Link>
                </Button>
                <Button asChild variant="outline" className="min-h-11 w-full font-semibold">
                  <Link href="/tasks">Задачи</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function EquipmentTables({ rows, onOpenContract }: { rows: OperationalEquipmentRow[]; onOpenContract: (id: string) => void }) {
  return (
    <>
      <Card className="hidden overflow-hidden border-border/80 shadow-xs sm:block">
        <CardContent className="p-0" data-testid="section-operational-equipment">
          <div className="max-h-[min(70vh,560px)] overflow-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 shadow-sm backdrop-blur-sm">
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">Клиент</th>
                  <th className="px-3 py-2.5">Город</th>
                  <th className="px-3 py-2.5">Номенклатура</th>
                  <th className="px-3 py-2.5">Кол-во</th>
                  <th className="px-3 py-2.5">Сумма</th>
                  <th className="px-3 py-2.5">Дата</th>
                  <th className="px-3 py-2.5">Ср. заказ / мес.</th>
                  <th className="px-3 py-2.5 text-right">Договор</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.equipmentId} className="border-b border-border/50 odd:bg-card even:bg-muted/[0.35] transition-colors hover:bg-muted/50" data-testid={`row-operational-equipment-${row.equipmentId}`}>
                    <td className="max-w-[9rem] px-3 py-2.5">
                      <span className="line-clamp-2 text-sm font-medium text-foreground">{row.clientName}</span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{row.city}</td>
                    <td className="max-w-[13rem] px-3 py-2.5 text-sm font-semibold leading-snug text-foreground">{row.nomenclature}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{row.quantity}</td>
                    <td className="px-3 py-2.5 text-base font-semibold tabular-nums text-foreground">{formatCompactRub(row.amountRub)}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{row.realizationDate}</td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-muted-foreground">{formatCompactRub(row.avgMonthlyOrderRub)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 min-h-8 border-primary/35 bg-primary/5 px-3 text-xs font-semibold text-foreground hover:bg-primary/10"
                        data-testid={`button-operational-open-equipment-contract-${row.equipmentId}`}
                        onClick={() => onOpenContract(row.equipmentId)}
                      >
                        Договор
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <Card key={row.equipmentId} className="border-border/80 shadow-xs ring-1 ring-black/[0.02]" data-testid={`row-operational-equipment-${row.equipmentId}`}>
            <CardHeader className="space-y-2 border-b border-border/50 pb-3 pt-4">
              <CardTitle className="text-base font-semibold leading-snug text-foreground">{row.nomenclature}</CardTitle>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="max-w-full whitespace-normal text-left text-[11px]">
                  {row.clientName}
                </Badge>
                <Badge variant="outline" className="text-[11px] text-muted-foreground">
                  {row.city}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pb-4 pt-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Количество</p>
                  <p className="text-lg font-semibold tabular-nums text-muted-foreground">{row.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">Сумма</p>
                  <p className="text-xl font-bold tabular-nums text-foreground">{formatCompactRub(row.amountRub)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase">Реализация</p>
                  <p className="font-medium text-foreground">{row.realizationDate}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase">Ср. заказ / мес.</p>
                  <p className="font-medium tabular-nums text-foreground">{formatCompactRub(row.avgMonthlyOrderRub)}</p>
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground">Документ будет доступен после подключения закрытого хранилища.</p>
              <Button
                type="button"
                className="w-full min-h-11 border-primary/35 bg-primary/8 font-semibold"
                variant="outline"
                data-testid={`button-operational-open-equipment-contract-${row.equipmentId}`}
                onClick={() => onOpenContract(row.equipmentId)}
              >
                Договор
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
