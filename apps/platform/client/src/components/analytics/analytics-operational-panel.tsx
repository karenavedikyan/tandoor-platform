"use client";

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ANALYTICS_PERIOD_OPTIONS,
  ANALYTICS_TERRITORY_OPTIONS,
  ANALYTICS_CITY_OPTIONS,
} from "@/lib/sales-manager-kpi-data";
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
  kpiHardware,
  kpiEquipment,
  DEALER_CATEGORY_FILTER_OPTIONS,
  OPERATIONAL_PRODUCT_LINE_OPTIONS,
} from "@/lib/analytics-operational-data";
import { DEALER_BASE_ROWS, type DealerRow } from "@/lib/dealer-base-mock-data";
import { formatCompactRub, formatPercent, formatUnits } from "@/lib/sales-manager-kpi-data";
import { EquipmentContractDialog } from "@/components/analytics/equipment-contract-dialog";

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

function ModelChips({ models }: { models: { productId: string; label: string }[] }) {
  if (models.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex max-w-[14rem] flex-wrap gap-1">
      {models.slice(0, 4).map((m) => (
        <Button key={m.productId} asChild variant="secondary" size="sm" className="h-7 max-w-[10rem] truncate px-2 text-xs font-medium">
          <Link href={`/catalog/${m.productId}`} title={m.label} data-testid={`button-operational-open-product-${m.productId}`}>
            {m.label}
          </Link>
        </Button>
      ))}
      {models.length > 4 ? <span className="text-xs text-muted-foreground">+{models.length - 4}</span> : null}
    </div>
  );
}

function PartnerKpiCards({ rows }: { rows: OperationalClientShowcaseRow[] }) {
  const k = useMemo(() => kpiForClientShowcase(rows), [rows]);
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Card className="border-border/70 shadow-xs" data-testid="card-operational-kpi-clients">
        <CardHeader className="pb-1 pt-3">
          <CardTitle className="text-xs font-medium text-muted-foreground">Клиентов</CardTitle>
        </CardHeader>
        <CardContent className="pb-3 pt-0">
          <p className="text-xl font-semibold tabular-nums">{k.clients}</p>
        </CardContent>
      </Card>
      <Card className="border-border/70 shadow-xs" data-testid="card-operational-kpi-showcase-models">
        <CardHeader className="pb-1 pt-3">
          <CardTitle className="text-xs font-medium text-muted-foreground">Моделей на витринах</CardTitle>
        </CardHeader>
        <CardContent className="pb-3 pt-0">
          <p className="text-xl font-semibold tabular-nums">{k.models}</p>
        </CardContent>
      </Card>
      <Card className="border-border/70 shadow-xs" data-testid="card-operational-kpi-showcase-sales">
        <CardHeader className="pb-1 pt-3">
          <CardTitle className="text-xs font-medium text-muted-foreground">Продажи по витринам</CardTitle>
        </CardHeader>
        <CardContent className="pb-3 pt-0">
          <p className="text-xl font-semibold tabular-nums">{k.showcaseSales}</p>
        </CardContent>
      </Card>
      <Card className="border-border/70 shadow-xs" data-testid="card-operational-kpi-conversion">
        <CardHeader className="pb-1 pt-3">
          <CardTitle className="text-xs font-medium text-muted-foreground">Средняя конверсия</CardTitle>
        </CardHeader>
        <CardContent className="pb-3 pt-0">
          <p className="text-xl font-semibold tabular-nums">{formatPercent(k.avgConv)}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function PartnerTableDesktop({ rows }: { rows: OperationalClientShowcaseRow[] }) {
  return (
    <div className="hidden overflow-x-auto rounded-xl border border-border/70 sm:block">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 backdrop-blur-sm">
          <tr className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="whitespace-nowrap px-3 py-2">Категория</th>
            <th className="whitespace-nowrap px-3 py-2">Город</th>
            <th className="min-w-[8rem] px-3 py-2">Клиент</th>
            <th className="px-3 py-2">МК на витрине</th>
            <th className="px-3 py-2">ВХ на витрине</th>
            <th className="whitespace-nowrap px-3 py-2">Полотна</th>
            <th className="whitespace-nowrap px-3 py-2">Проверка</th>
            <th className="whitespace-nowrap px-3 py-2">Выставлено</th>
            <th className="whitespace-nowrap px-3 py-2">Продажи</th>
            <th className="whitespace-nowrap px-3 py-2">По витринам</th>
            <th className="whitespace-nowrap px-3 py-2">Конв.</th>
            <th className="whitespace-nowrap px-3 py-2 text-right">Действия</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.dealerId} className="border-b border-border/60 odd:bg-card even:bg-muted/20" data-testid={`row-operational-client-${row.dealerId}`}>
              <td className="px-3 py-2 font-medium">{row.clientCategory}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.city}</td>
              <td className="max-w-[10rem] px-3 py-2">
                <span className="line-clamp-2 font-medium text-foreground">{row.clientName}</span>
              </td>
              <td className="px-3 py-2 align-top">
                <ModelChips models={row.mkModels} />
              </td>
              <td className="px-3 py-2 align-top">
                <ModelChips models={row.vhModels} />
              </td>
              <td className="px-3 py-2 tabular-nums">{row.unitsOnShowcase}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.checkDate}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.setupDate}</td>
              <td className="px-3 py-2 tabular-nums">{row.totalSales}</td>
              <td className="px-3 py-2 tabular-nums">{row.showcaseSales}</td>
              <td className="px-3 py-2 tabular-nums font-medium">{formatPercent(row.conversionPercent)}</td>
              <td className="px-3 py-2 text-right">
                <Button asChild size="sm" variant="outline" className="font-semibold" data-testid={`button-operational-open-dealer-${row.dealerId}`}>
                  <Link href={`/dealers/${row.dealerId}`}>Клиент</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PartnerCardsMobile({ rows }: { rows: OperationalClientShowcaseRow[] }) {
  return (
    <div className="space-y-3 sm:hidden">
      {rows.map((row) => (
        <Card key={row.dealerId} className="border-border/70 shadow-xs" data-testid={`row-operational-client-${row.dealerId}`}>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-base leading-snug">{row.clientName}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {row.clientCategory} · {row.city}
            </p>
          </CardHeader>
          <CardContent className="space-y-2 pb-3 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">МК</p>
              <ModelChips models={row.mkModels} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-muted-foreground">ВХ</p>
              <ModelChips models={row.vhModels} />
            </div>
            <p className="text-xs text-muted-foreground">
              Полотна: <span className="font-medium text-foreground">{row.unitsOnShowcase}</span> · Проверка: {row.checkDate} · Выставлено: {row.setupDate}
            </p>
            <p className="text-xs">
              Продажи: <span className="font-semibold">{row.totalSales}</span> · По витринам: <span className="font-semibold">{row.showcaseSales}</span> ·
              Конверсия: <span className="font-semibold">{formatPercent(row.conversionPercent)}</span>
            </p>
            <Button asChild className="w-full min-h-11 font-semibold" data-testid={`button-operational-open-dealer-${row.dealerId}`}>
              <Link href={`/dealers/${row.dealerId}`}>Открыть клиента</Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AnalyticsOperationalPanel() {
  const [globalFilters, setGlobalFilters] = useState<OperationalGlobalFilters>({
    periodKey: "month",
    territoryId: "south",
    cityId: "all",
    dealerCategory: "all",
    productLine: "all",
    search: "",
  });

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

  const rowsTop500 = useMemo(() => filterClientShowcaseRows("top500", globalFilters, showcaseStatus), [globalFilters, showcaseStatus]);
  const rows500Plus = useMemo(() => filterClientShowcaseRows("fiveHundredPlus", globalFilters, showcaseStatus), [globalFilters, showcaseStatus]);
  const rowsClub = useMemo(() => filterClientShowcaseRows("tandoorClub", globalFilters, showcaseStatus), [globalFilters, showcaseStatus]);

  const profitRows = useMemo(() => filterShowcaseProfitabilityRows(globalFilters, profitAttention), [globalFilters, profitAttention]);

  const hwRows = useMemo(() => filterHardwareRows(globalFilters, hwConv, hwCompetitors, hwOurEq), [globalFilters, hwConv, hwCompetitors, hwOurEq]);

  const eqRows = useMemo(() => filterEquipmentRows(globalFilters, eqDealer, eqNom, eqPeriod), [globalFilters, eqDealer, eqNom, eqPeriod]);

  const hwKpi = useMemo(() => kpiHardware(hwRows), [hwRows]);
  const eqKpi = useMemo(() => kpiEquipment(eqRows), [eqRows]);

  return (
    <div className="min-w-0 space-y-6">
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base">Общие фильтры</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pb-4" data-testid="section-operational-filters">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Период</span>
              <Select
                value={globalFilters.periodKey}
                onValueChange={(v) => setGlobalFilters((f) => ({ ...f, periodKey: v as OperationalGlobalFilters["periodKey"] }))}
              >
                <SelectTrigger className="h-11 min-h-[44px]" data-testid="select-operational-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANALYTICS_PERIOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Территория</span>
              <Select value={globalFilters.territoryId} onValueChange={(v) => setGlobalFilters((f) => ({ ...f, territoryId: v }))}>
                <SelectTrigger className="h-11 min-h-[44px]" data-testid="select-operational-territory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANALYTICS_TERRITORY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Город</span>
              <Select value={globalFilters.cityId} onValueChange={(v) => setGlobalFilters((f) => ({ ...f, cityId: v }))}>
                <SelectTrigger className="h-11 min-h-[44px]" data-testid="select-operational-city">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANALYTICS_CITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Категория клиента</span>
              <Select
                value={globalFilters.dealerCategory}
                onValueChange={(v) => setGlobalFilters((f) => ({ ...f, dealerCategory: v as OperationalGlobalFilters["dealerCategory"] }))}
              >
                <SelectTrigger className="h-11 min-h-[44px]" data-testid="select-operational-client-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEALER_CATEGORY_FILTER_OPTIONS.map((o) => (
                    <SelectItem key={String(o.value)} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Линейка</span>
              <Select
                value={globalFilters.productLine}
                onValueChange={(v) => setGlobalFilters((f) => ({ ...f, productLine: v as OperationalGlobalFilters["productLine"] }))}
              >
                <SelectTrigger className="h-11 min-h-[44px]" data-testid="select-operational-product-line">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATIONAL_PRODUCT_LINE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Поиск</span>
              <Input
                value={globalFilters.search}
                onChange={(e) => setGlobalFilters((f) => ({ ...f, search: e.target.value }))}
                placeholder="Клиент, город, модель…"
                className="h-11 min-h-[44px]"
                data-testid="input-operational-search"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={opTab} onValueChange={(v) => setOpTab(v as OperationalAnalyticsTab)} className="w-full min-w-0" data-testid="tabs-analytics-operational">
        <TabsList className="flex h-auto w-full min-w-0 flex-wrap gap-1 p-1">
          <TabsTrigger value="top500" className="min-h-9 flex-1 px-2 text-xs sm:flex-initial sm:text-sm" data-testid="tab-operational-top500">
            ТОП 500
          </TabsTrigger>
          <TabsTrigger value="fiveHundredPlus" className="min-h-9 flex-1 px-2 text-xs sm:flex-initial sm:text-sm" data-testid="tab-operational-500-plus">
            500+
          </TabsTrigger>
          <TabsTrigger value="tandoorClub" className="min-h-9 flex-1 px-2 text-xs sm:flex-initial sm:text-sm" data-testid="tab-operational-tandoor-club">
            Tandoor Club
          </TabsTrigger>
          <TabsTrigger value="showcaseProfitability" className="min-h-9 flex-1 px-2 text-xs sm:flex-initial sm:text-sm" data-testid="tab-operational-showcase-profitability">
            Рентабельность витрин
          </TabsTrigger>
          <TabsTrigger value="hardwareConversion" className="min-h-9 flex-1 px-2 text-xs sm:flex-initial sm:text-sm" data-testid="tab-operational-hardware-conversion">
            Конверсия фурнитуры
          </TabsTrigger>
          <TabsTrigger value="equipment" className="min-h-9 flex-1 px-2 text-xs sm:flex-initial sm:text-sm" data-testid="tab-operational-equipment">
            Оборудование
          </TabsTrigger>
        </TabsList>

        <TabsContent value="top500" className="mt-4 space-y-4 focus-visible:ring-0">
          <div data-testid="section-operational-top500">
            <PartnerSegmentBody rows={rowsTop500} showcaseStatus={showcaseStatus} onShowcaseStatus={setShowcaseStatus} />
          </div>
        </TabsContent>
        <TabsContent value="fiveHundredPlus" className="mt-4 space-y-4 focus-visible:ring-0">
          <div data-testid="section-operational-500-plus">
            <PartnerSegmentBody rows={rows500Plus} showcaseStatus={showcaseStatus} onShowcaseStatus={setShowcaseStatus} />
          </div>
        </TabsContent>
        <TabsContent value="tandoorClub" className="mt-4 space-y-4 focus-visible:ring-0">
          <div data-testid="section-operational-tandoor-club">
            <PartnerSegmentBody rows={rowsClub} showcaseStatus={showcaseStatus} onShowcaseStatus={setShowcaseStatus} />
          </div>
        </TabsContent>

        <TabsContent value="showcaseProfitability" className="mt-4 space-y-4 focus-visible:ring-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[12rem] flex-1">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Зона внимания</span>
              <Select value={profitAttention} onValueChange={(v) => setProfitAttention(v as typeof profitAttention)}>
                <SelectTrigger className="h-11 min-h-[44px]">
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
            <Button asChild variant="outline" className="min-h-11 w-full border-border font-semibold sm:w-auto" data-testid="button-operational-open-tasks">
              <Link href="/tasks">К задачам</Link>
            </Button>
          </div>
          <ProfitabilityTables rows={profitRows} />
        </TabsContent>

        <TabsContent value="hardwareConversion" className="mt-4 space-y-4 focus-visible:ring-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/70 shadow-xs" data-testid="card-operational-kpi-hw-mk">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Продажи МК</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-xl font-semibold tabular-nums">{formatUnits(hwKpi.mk)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-xs" data-testid="card-operational-kpi-hw-furn">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Продажи фурнитуры</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-xl font-semibold tabular-nums">{formatUnits(hwKpi.hw)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-xs" data-testid="card-operational-kpi-hw-avg">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Средняя конверсия</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-xl font-semibold tabular-nums">{formatPercent(hwKpi.avg)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-xs" data-testid="card-operational-kpi-hw-low">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Низкая конверсия</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-xl font-semibold tabular-nums">{hwKpi.low}</p>
              </CardContent>
            </Card>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="min-w-[10rem]">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Конверсия</span>
              <Select value={hwConv} onValueChange={(v) => setHwConv(v as typeof hwConv)}>
                <SelectTrigger className="h-11 min-h-[44px]">
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
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={hwCompetitors === true} onChange={() => setHwCompetitors(hwCompetitors === true ? null : true)} className="h-4 w-4 rounded border-border" />
              Есть конкуренты
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={hwOurEq === true} onChange={() => setHwOurEq(hwOurEq === true ? null : true)} className="h-4 w-4 rounded border-border" />
              Наше оборудование
            </label>
            <Button asChild variant="outline" className="min-h-11 border-border font-semibold" data-testid="button-operational-open-tasks">
              <Link href="/tasks">К задачам</Link>
            </Button>
          </div>
          <HardwareTables rows={hwRows} />
        </TabsContent>

        <TabsContent value="equipment" className="mt-4 space-y-4 focus-visible:ring-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/70 shadow-xs" data-testid="card-operational-kpi-eq-units">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Единиц оборудования</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-xl font-semibold tabular-nums">{eqKpi.units}</p>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-xs" data-testid="card-operational-kpi-eq-sum">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Сумма реализации</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-xl font-semibold tabular-nums">{formatCompactRub(eqKpi.sum)}</p>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-xs" data-testid="card-operational-kpi-eq-clients">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Клиентов с оборудованием</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-xl font-semibold tabular-nums">{eqKpi.clients}</p>
              </CardContent>
            </Card>
            <Card className="border-border/70 shadow-xs" data-testid="card-operational-kpi-eq-avg">
              <CardHeader className="pb-1 pt-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Средняя сумма заказов / мес.</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-xl font-semibold tabular-nums">{formatCompactRub(eqKpi.avgM)}</p>
              </CardContent>
            </Card>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[10rem] flex-1">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Клиент</span>
              <Select value={eqDealer} onValueChange={(v) => setEqDealer(v as typeof eqDealer)}>
                <SelectTrigger className="h-11 min-h-[44px]">
                  <SelectValue placeholder="Все" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все клиенты</SelectItem>
                  {DEALER_BASE_ROWS.map((d: DealerRow) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[10rem] flex-1">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Номенклатура</span>
              <Input value={eqNom} onChange={(e) => setEqNom(e.target.value)} placeholder="Фильтр…" className="h-11 min-h-[44px]" />
            </div>
            <div className="min-w-[10rem]">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Период реализации</span>
              <Select value={eqPeriod} onValueChange={(v) => setEqPeriod(v as EquipmentPeriodFilter)}>
                <SelectTrigger className="h-11 min-h-[44px]">
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
          <EquipmentTables rows={eqRows} onOpenContract={(id) => setContractId(id)} />
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
}: {
  rows: OperationalClientShowcaseRow[];
  showcaseStatus: ShowcaseCheckStatus | "all";
  onShowcaseStatus: (v: ShowcaseCheckStatus | "all") => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[12rem]">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Статус витрины</span>
          <Select value={showcaseStatus} onValueChange={(v) => onShowcaseStatus(v as typeof showcaseStatus)}>
            <SelectTrigger className="h-11 min-h-[44px]">
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
      <PartnerKpiCards rows={rows} />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Нет строк по выбранным условиям.</p>
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
      <div className="hidden overflow-x-auto rounded-xl border border-border/70 sm:block" data-testid="section-operational-showcase-profitability">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Клиент</th>
              <th className="px-3 py-2">Город</th>
              <th className="px-3 py-2">Категория</th>
              <th className="px-3 py-2">Наши витрины</th>
              <th className="px-3 py-2">Конкуренты</th>
              <th className="px-3 py-2">Продажи</th>
              <th className="px-3 py-2">По витринам</th>
              <th className="px-3 py-2">Рентабельность</th>
              <th className="px-3 py-2">Доля витрины</th>
              <th className="px-3 py-2 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowTestId = row.tradePointId ? `row-operational-showcase-${row.dealerId}-${row.tradePointId}` : `row-operational-showcase-${row.dealerId}`;
              const warn = row.attentionZone === "low_profit" || row.attentionZone === "no_showcase_sales" || row.attentionZone === "many_competitors";
              return (
                <tr key={row.rowKey} className={cn("border-b border-border/60", warn ? "bg-amber-50/50" : "odd:bg-card even:bg-muted/15")} data-testid={rowTestId}>
                  <td className="max-w-[10rem] px-3 py-2 font-medium">
                    <span className="line-clamp-2">{row.clientName}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.city}</td>
                  <td className="px-3 py-2">{row.clientCategory}</td>
                  <td className="px-3 py-2 tabular-nums">{row.ourShowcases}</td>
                  <td className="px-3 py-2 tabular-nums">{row.competitorShowcases}</td>
                  <td className="px-3 py-2 tabular-nums">{row.totalSales}</td>
                  <td className="px-3 py-2 tabular-nums">{row.showcaseSales}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="font-semibold">
                      {row.profitabilityLabel}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex min-w-[6rem] flex-col gap-1">
                      <Progress value={Math.min(100, row.shareShowcasePercent)} className="h-2" />
                      <span className="text-xs tabular-nums text-muted-foreground">{formatPercent(row.shareShowcasePercent)}</span>
                    </div>
                  </td>
                  <td className="space-y-1 px-3 py-2 text-right">
                    <Button asChild size="sm" variant="outline" className="font-semibold" data-testid={`button-operational-open-dealer-${row.dealerId}`}>
                      <Link href={`/dealers/${row.dealerId}`}>Клиент</Link>
                    </Button>
                    {row.tradePointId ? (
                      <Button asChild size="sm" variant="secondary" className="ml-0 font-semibold" data-testid={`button-operational-open-trade-point-${row.tradePointId}`}>
                        <Link href={`/dealers/${row.dealerId}/trade-points/${row.tradePointId}`}>ТТ</Link>
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => {
          const rowTestId = row.tradePointId ? `row-operational-showcase-${row.dealerId}-${row.tradePointId}` : `row-operational-showcase-${row.dealerId}`;
          return (
            <Card key={row.rowKey} className="border-border/70 shadow-xs" data-testid={rowTestId}>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base leading-snug">{row.clientName}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {row.city} · {row.clientCategory}
                </p>
              </CardHeader>
              <CardContent className="space-y-2 pb-3 text-sm">
                <p>
                  Витрины: наши {row.ourShowcases}, конкурентов {row.competitorShowcases}
                </p>
                <p>
                  Продажи: {row.totalSales}, по витринам: {row.showcaseSales}
                </p>
                <Badge variant="outline">{row.profitabilityLabel}</Badge>
                <Progress value={Math.min(100, row.shareShowcasePercent)} className="h-2" />
                <div className="flex flex-col gap-2">
                  <Button asChild className="min-h-11 font-semibold" data-testid={`button-operational-open-dealer-${row.dealerId}`}>
                    <Link href={`/dealers/${row.dealerId}`}>Клиент</Link>
                  </Button>
                  {row.tradePointId ? (
                    <Button asChild variant="outline" className="min-h-11 font-semibold" data-testid={`button-operational-open-trade-point-${row.tradePointId}`}>
                      <Link href={`/dealers/${row.dealerId}/trade-points/${row.tradePointId}`}>Торговая точка</Link>
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
      <div className="hidden overflow-x-auto rounded-xl border border-border/70 sm:block" data-testid="section-operational-hardware-conversion">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 text-xs font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Клиент</th>
              <th className="px-3 py-2">Город</th>
              <th className="px-3 py-2">Категория</th>
              <th className="px-3 py-2">МК</th>
              <th className="px-3 py-2">Фурнитура</th>
              <th className="px-3 py-2">Конв.</th>
              <th className="px-3 py-2">Конкуренты</th>
              <th className="px-3 py-2">ТОП конкурентов</th>
              <th className="min-w-[8rem] px-3 py-2">Причина</th>
              <th className="px-3 py-2">Склад</th>
              <th className="px-3 py-2">Наше оборуд.</th>
              <th className="px-3 py-2 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.dealerId} className="border-b border-border/60 odd:bg-card even:bg-muted/15" data-testid={`row-operational-hardware-${row.dealerId}`}>
                <td className="max-w-[9rem] px-3 py-2 font-medium">
                  <span className="line-clamp-2">{row.clientName}</span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{row.city}</td>
                <td className="px-3 py-2">{row.clientCategory}</td>
                <td className="px-3 py-2 tabular-nums">{row.mkSales}</td>
                <td className="px-3 py-2 tabular-nums">{row.hardwareSales}</td>
                <td className="px-3 py-2 tabular-nums font-medium">{formatPercent(row.conversionPercent)}</td>
                <td className="max-w-[10rem] px-3 py-2 text-xs text-muted-foreground">{row.competitorsSummary || "—"}</td>
                <td className="max-w-[8rem] px-3 py-2 text-xs">{row.topCompetitorModels}</td>
                <td className="max-w-[12rem] px-3 py-2 text-xs leading-snug text-muted-foreground">{row.reasonNotWithUs}</td>
                <td className="px-3 py-2">{row.worksUnderStock ? "Да" : "Нет"}</td>
                <td className="px-3 py-2">{row.ourEquipment ? "Да" : "Нет"}</td>
                <td className="space-y-1 px-3 py-2 text-right">
                  <Button asChild size="sm" variant="outline" className="font-semibold" data-testid={`button-operational-open-dealer-${row.dealerId}`}>
                    <Link href={`/dealers/${row.dealerId}`}>Клиент</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <Card key={row.dealerId} className="border-border/70 shadow-xs" data-testid={`row-operational-hardware-${row.dealerId}`}>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-base">{row.clientName}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {row.city} · {row.clientCategory}
              </p>
            </CardHeader>
            <CardContent className="space-y-2 pb-3 text-sm">
              <p>
                МК: {row.mkSales} · Фурнитура: {row.hardwareSales} · Конверсия: {formatPercent(row.conversionPercent)}
              </p>
              <p className="text-xs text-muted-foreground">{row.reasonNotWithUs}</p>
              <div className="flex flex-col gap-2">
                <Button asChild className="min-h-11 font-semibold" data-testid={`button-operational-open-dealer-${row.dealerId}`}>
                  <Link href={`/dealers/${row.dealerId}`}>Клиент</Link>
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
      <div className="hidden overflow-x-auto rounded-xl border border-border/70 sm:block" data-testid="section-operational-equipment">
        <table className="w-full min-w-[840px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted/95 text-xs font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Клиент</th>
              <th className="px-3 py-2">Город</th>
              <th className="px-3 py-2">Номенклатура</th>
              <th className="px-3 py-2">Кол-во</th>
              <th className="px-3 py-2">Сумма</th>
              <th className="px-3 py-2">Дата</th>
              <th className="px-3 py-2">Ср. заказ / мес.</th>
              <th className="px-3 py-2 text-right">Договор</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.equipmentId} className="border-b border-border/60 odd:bg-card even:bg-muted/15" data-testid={`row-operational-equipment-${row.equipmentId}`}>
                <td className="max-w-[9rem] px-3 py-2 font-medium">
                  <span className="line-clamp-2">{row.clientName}</span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{row.city}</td>
                <td className="max-w-[12rem] px-3 py-2 text-xs">{row.nomenclature}</td>
                <td className="px-3 py-2 tabular-nums">{row.quantity}</td>
                <td className="px-3 py-2 tabular-nums">{formatCompactRub(row.amountRub)}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.realizationDate}</td>
                <td className="px-3 py-2 tabular-nums">{formatCompactRub(row.avgMonthlyOrderRub)}</td>
                <td className="px-3 py-2 text-right">
                  <Button type="button" variant="outline" size="sm" className="font-semibold" data-testid={`button-operational-open-equipment-contract-${row.equipmentId}`} onClick={() => onOpenContract(row.equipmentId)}>
                    Договор
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <Card key={row.equipmentId} className="border-border/70 shadow-xs" data-testid={`row-operational-equipment-${row.equipmentId}`}>
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-base leading-snug">{row.nomenclature}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {row.clientName} · {row.city}
              </p>
            </CardHeader>
            <CardContent className="space-y-2 pb-3 text-sm">
              <p>
                Количество: {row.quantity} · Сумма: {formatCompactRub(row.amountRub)}
              </p>
              <p className="text-xs text-muted-foreground">Реализация: {row.realizationDate}</p>
              <Button type="button" className="w-full min-h-11 font-semibold" variant="outline" data-testid={`button-operational-open-equipment-contract-${row.equipmentId}`} onClick={() => onOpenContract(row.equipmentId)}>
                Договор
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
