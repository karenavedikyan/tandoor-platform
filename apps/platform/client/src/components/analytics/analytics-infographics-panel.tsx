import { useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  OPERATIONAL_DEFAULT_GLOBAL_FILTERS,
  filterEquipmentRows,
  getInfographicCitySegments,
  getInfographicClientSegmentCards,
  getInfographicEquipmentNomenclatureBars,
  getInfographicEquipmentTopClients,
  getInfographicHardwareOperationalKpi,
  getInfographicHardwareRiskClients,
  getInfographicShowcaseModels,
  getInfographicShowcaseProfitabilityBars,
  getInfographicShowcaseRiskClients,
  kpiEquipment,
  type ShowcaseAttentionZone,
} from "@/lib/analytics-operational-data";
import {
  formatCompactRub,
  formatPercent,
  formatUnits,
  getAnalyticsInfographicCities,
  getAnalyticsInfographicPlanItems,
  getAnalyticsMonthlyDynamics,
  getAnalyticsTopPartners,
  getAnalyticsTopProductsCity,
  getAnalyticsTopProductsTerritory,
  getAnalyticsYoYItems,
  getHardwareConversionFunnel,
  getTrendColorClass,
  getTrendLabel,
  type HardwareConversionFunnelStep,
  type InfographicMonthlyPoint,
  type InfographicPlanItem,
  type InfographicTopItem,
  type InfographicYoYItem,
} from "@/lib/sales-manager-kpi-data";

function RadialPlanChart({ item, testId }: { item: InfographicPlanItem; testId: string }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, item.completionPercent);
  const dash = c * (pct / 100);
  const gap = c - dash;
  const isUnits = item.unit === "units";
  return (
    <Card className="min-w-0 rounded-2xl border border-border/80 bg-card shadow-md" data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{item.label}</CardTitle>
        <p className="text-xs text-muted-foreground">{isUnits ? "Штуки" : "Оборот, ₽"}</p>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="relative h-[140px] w-[140px] shrink-0" aria-hidden>
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${gap}`}
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-semibold tabular-nums text-foreground">{formatPercent(pct)}</span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">выполнение</span>
          </div>
        </div>
        <div className="w-full space-y-1.5 text-center text-xs text-muted-foreground sm:text-left">
          <p>
            План: <span className="font-semibold text-foreground">{isUnits ? formatUnits(item.plan) : formatCompactRub(item.plan)}</span>
          </p>
          <p>
            Факт: <span className="font-semibold text-foreground">{isUnits ? formatUnits(item.fact) : formatCompactRub(item.fact)}</span>
          </p>
          <p>
            Прогноз: <span className="font-semibold text-foreground">{isUnits ? formatUnits(item.forecast) : formatCompactRub(item.forecast)}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMonthChart({
  title,
  unitLabel,
  points,
  accessor,
  colorClass,
}: {
  title: string;
  unitLabel: string;
  points: InfographicMonthlyPoint[];
  accessor: (p: InfographicMonthlyPoint) => number;
  colorClass: string;
}) {
  const max = Math.max(...points.map(accessor), 1);
  return (
    <Card className="min-w-0 rounded-2xl border border-border/80 bg-card shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{unitLabel}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex h-28 items-end justify-between gap-1 px-0.5">
          {points.map((pt) => {
            const v = accessor(pt);
            const px = Math.max(6, Math.round((v / max) * 88));
            return (
              <div key={pt.month} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <div
                  className={cn("w-full max-w-[32px] rounded-t-sm", colorClass)}
                  style={{ height: `${px}px` }}
                  title={`${pt.month}: ${v}`}
                />
                <span className="truncate text-[10px] text-muted-foreground">{pt.month}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function YoYChartCard({ item, testId }: { item: InfographicYoYItem; testId: string }) {
  const isUnits = item.unit === "units";
  const deltaLabel =
    item.unit === "money"
      ? `${item.absoluteDelta >= 0 ? "+" : "−"}${formatCompactRub(Math.abs(item.absoluteDelta))}`
      : `${item.absoluteDelta >= 0 ? "+" : "−"}${formatUnits(Math.abs(item.absoluteDelta))}`;
  return (
    <Card className="min-w-0 rounded-2xl border border-border/80 bg-card shadow-md" data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{item.label}</CardTitle>
        <p className="text-xs text-muted-foreground">{isUnits ? "Штуки" : "Оборот, ₽"}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div>
            <p className="text-xs text-muted-foreground">Текущий период</p>
            <p className="font-semibold tabular-nums text-foreground">
              {isUnits ? formatUnits(item.currentValue) : formatCompactRub(item.currentValue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Год назад</p>
            <p className="font-semibold tabular-nums text-foreground">
              {isUnits ? formatUnits(item.previousYearValue) : formatCompactRub(item.previousYearValue)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("text-xs font-semibold", getTrendColorClass(item.trend))}>
            {getTrendLabel(item.trend)}
          </Badge>
          <span className={cn("font-semibold tabular-nums", getTrendColorClass(item.trend))}>
            {deltaLabel} ({item.percentDelta > 0 ? "+" : ""}
            {String(item.percentDelta).replace(".", ",")}%)
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Сравнение величин (шкала 0 — максимум из пары)</p>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-muted-foreground/35"
              style={{
                width: `${Math.min(100, (item.previousYearValue / Math.max(item.currentValue, item.previousYearValue, 1)) * 100)}%`,
              }}
            />
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary"
              style={{
                width: `${Math.min(100, (item.currentValue / Math.max(item.currentValue, item.previousYearValue, 1)) * 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">Верхняя полоса — прошлый год, нижняя — текущий период.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function HorizontalBarRow({
  label,
  value,
  max,
  valueText,
  suffix,
}: {
  label: string;
  value: number;
  max: number;
  valueText: string;
  suffix?: string;
}) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap justify-between gap-2 text-xs">
        <span className="min-w-0 truncate font-medium text-foreground">{label}</span>
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {valueText}
          {suffix ? ` · ${suffix}` : ""}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function attentionZoneLabel(zone: ShowcaseAttentionZone): string {
  switch (zone) {
    case "high_profit":
      return "Высокая маржа";
    case "low_profit":
      return "Низкая маржа";
    case "many_competitors":
      return "Сильная конкуренция";
    case "no_showcase_sales":
      return "Слабые продажи с витрины";
    default:
      return "Зона внимания";
  }
}

function segmentCardTestId(segment: string): string {
  if (segment === "top500") return "card-infographic-segment-top500";
  if (segment === "fiveHundredPlus") return "card-infographic-segment-500-plus";
  return "card-infographic-segment-tandoor-club";
}

function TopBars({ items, testId, subtitle }: { items: InfographicTopItem[]; testId: string; subtitle: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-3" data-testid={testId}>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      {items.map((row) => {
        const valueText = row.unit === "units" ? formatUnits(row.value) : formatCompactRub(row.value);
        return (
          <HorizontalBarRow
            key={row.id}
            label={row.name}
            value={row.value}
            max={max}
            valueText={valueText}
            suffix={`вклад ~${row.sharePercent}%`}
          />
        );
      })}
    </div>
  );
}

export function AnalyticsInfographicsPanel() {
  const planItems = useMemo(() => getAnalyticsInfographicPlanItems(), []);
  const monthly = useMemo(() => getAnalyticsMonthlyDynamics(), []);
  const yoy = useMemo(() => getAnalyticsYoYItems(), []);
  const cities = useMemo(() => getAnalyticsInfographicCities(), []);
  const partnerShares = useMemo(
    () =>
      [
        { label: "TOP", share: 8 },
        { label: "Активные", share: 42 },
        { label: "Потенциальные", share: 31 },
        { label: "Без активности", share: 13 },
        { label: "Внимание", share: 6 },
      ] as const,
    [],
  );
  const topsTerritory = useMemo(() => getAnalyticsTopProductsTerritory(), []);
  const topsCity = useMemo(() => getAnalyticsTopProductsCity(), []);
  const topsPartners = useMemo(() => getAnalyticsTopPartners(), []);
  const funnel = useMemo(() => getHardwareConversionFunnel(), []);

  const opFilters = OPERATIONAL_DEFAULT_GLOBAL_FILTERS;
  const segmentCards = useMemo(() => getInfographicClientSegmentCards(opFilters), []);
  const profitabilityBars = useMemo(() => getInfographicShowcaseProfitabilityBars(opFilters), []);
  const showcaseRiskClients = useMemo(() => getInfographicShowcaseRiskClients(opFilters), []);
  const hwOpKpi = useMemo(() => getInfographicHardwareOperationalKpi(opFilters), []);
  const hwRiskClients = useMemo(() => getInfographicHardwareRiskClients(opFilters), []);
  const equipmentKpi = useMemo(
    () => kpiEquipment(filterEquipmentRows(opFilters, "all", "", "all")),
    [],
  );
  const equipmentNomBars = useMemo(() => getInfographicEquipmentNomenclatureBars(opFilters), []);
  const equipmentClients = useMemo(() => getInfographicEquipmentTopClients(opFilters), []);
  const citySegments = useMemo(() => getInfographicCitySegments(opFilters), []);
  const modelsMk = useMemo(() => getInfographicShowcaseModels(opFilters, "mk"), []);
  const modelsVh = useMemo(() => getInfographicShowcaseModels(opFilters, "vh"), []);

  const maxProfitScore = Math.max(...profitabilityBars.map((b) => b.profitabilityScore), 1);
  const maxEquipRub = Math.max(...equipmentNomBars.map((b) => b.amountRub), 1);

  const mk = planItems.find((p) => p.category === "mk")!;
  const vh = planItems.find((p) => p.category === "vh")!;
  const hw = planItems.find((p) => p.category === "hardware")!;
  const maxCityShare = Math.max(...cities.map((c) => c.regionSharePercent), 1);

  return (
    <div className="space-y-10">
      <section className="space-y-4" data-testid="section-analytics-infographic-plan">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Выполнение плана</h2>
        <p className="text-sm text-muted-foreground">МК и ВХ — штуки; фурнитура — оборот в рублях. Рядом с кругом — те же цифры, что в сводке.</p>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <RadialPlanChart item={mk} testId="chart-analytics-plan-mk" />
          <RadialPlanChart item={vh} testId="chart-analytics-plan-vh" />
          <RadialPlanChart item={hw} testId="chart-analytics-plan-hardware" />
        </div>
      </section>

      <section className="space-y-4" data-testid="section-analytics-infographic-month-dynamics">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Динамика по месяцам</h2>
        <p className="text-sm text-muted-foreground">Три отдельные шкалы: МК и ВХ в штуках, фурнитура в обороте (не смешаны).</p>
        <div className="grid min-w-0 gap-4 md:grid-cols-3" data-testid="chart-analytics-month-dynamics">
          <MiniMonthChart
            title="МК"
            unitLabel="Штуки"
            points={monthly}
            accessor={(p) => p.mkUnits}
            colorClass="bg-primary"
          />
          <MiniMonthChart
            title="ВХ"
            unitLabel="Штуки"
            points={monthly}
            accessor={(p) => p.vhUnits}
            colorClass="bg-primary/70"
          />
          <MiniMonthChart
            title="Фурнитура"
            unitLabel="Оборот, ₽"
            points={monthly}
            accessor={(p) => p.hardwareTurnoverRub}
            colorClass="bg-primary/45"
          />
        </div>
      </section>

      <section className="space-y-4" data-testid="section-analytics-infographic-yoy">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Год к году</h2>
        <p className="text-sm text-muted-foreground">Факт текущего месяца к аналогичному периоду прошлого года.</p>
        <div className="grid min-w-0 gap-4 lg:grid-cols-3">
          {yoy.map((item) => (
            <YoYChartCard
              key={item.category}
              item={item}
              testId={
                item.category === "mk"
                  ? "chart-analytics-yoy-mk"
                  : item.category === "vh"
                    ? "chart-analytics-yoy-vh"
                    : "chart-analytics-yoy-hardware"
              }
            />
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-infographic-client-segments">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Клиентские сегменты</h2>
        <p className="text-sm text-muted-foreground">
          Срез по витринам и моделям: ТОП 500, 500+, Tandoor Club. Показатели по клиентской базе и выкладке.
        </p>
        <div className="grid min-w-0 gap-4 sm:grid-cols-3">
          {segmentCards.map((s) => (
            <Card
              key={s.segment}
              className="min-w-0 rounded-2xl border border-border/80 bg-card shadow-md"
              data-testid={segmentCardTestId(s.segment)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{s.label}</CardTitle>
                <p className="text-xs text-muted-foreground">Клиенты с витриной в сегменте</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Клиентов: <span className="font-semibold tabular-nums text-foreground">{s.clients}</span>
                </p>
                <p>
                  Моделей на витринах: <span className="font-semibold tabular-nums text-foreground">{s.modelsOnShowcase}</span>
                </p>
                <p>
                  Продажи с витрины:{" "}
                  <span className="font-semibold tabular-nums text-foreground">{formatCompactRub(s.showcaseSales)}</span>
                </p>
                <p>
                  Средняя конверсия:{" "}
                  <span className="font-semibold tabular-nums text-foreground">{formatPercent(s.avgConversionPercent)}</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-infographic-showcase-profitability">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Рентабельность витрин</h2>
        <p className="text-sm text-muted-foreground">
          Клиенты с наименьшим индексом рентабельности (условный рейтинг). Доля продаж с витрины и витрины «мы / конкуренты».
        </p>
        <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Рейтинг по рентабельности</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4" data-testid="chart-infographic-showcase-profitability">
            {profitabilityBars.map((b) => (
              <div key={b.dealerId} className="min-w-0 space-y-1">
                <div className="flex flex-wrap justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate font-medium text-foreground">
                    {b.clientName} · {b.city}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {b.profitabilityLabel} · {b.shareShowcasePercent}% с витрины
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((b.profitabilityScore / maxProfitScore) * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Наши витрины: {b.ourShowcases} · конкуренты: {b.competitorShowcases}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {showcaseRiskClients.map((r) => (
            <Card
              key={r.dealerId}
              className="min-w-0 rounded-2xl border border-amber-500/25 bg-card shadow-md"
              data-testid={`card-infographic-showcase-risk-${r.dealerId}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base leading-snug">{r.clientName}</CardTitle>
                <p className="text-xs text-muted-foreground">{r.city}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {attentionZoneLabel(r.attentionZone)}
                </Badge>
                <p>
                  Рентабельность: <span className="font-semibold text-foreground">{r.profitabilityLabel}</span> (
                  {r.profitabilityScore})
                </p>
                <p className="tabular-nums">
                  Доля с витрины: {r.shareShowcasePercent}% · наши / конкуренты: {r.ourShowcases} / {r.competitorShowcases}
                </p>
                <Button asChild variant="outline" className="w-full min-h-9 border-border bg-card text-xs font-semibold">
                  <Link href={`/dealers/${r.dealerId}`}>Карточка клиента</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-infographic-hardware-conversion-operational">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Конверсия фурнитуры (операционный срез)</h2>
        <p className="text-sm text-muted-foreground">
          Суммарные отгрузки МК и фурнитуры по выборке и средняя конверсия; клиенты с низкой конверсией.
        </p>
        <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
          <CardContent className="space-y-4 p-4 sm:p-6" data-testid="chart-infographic-hardware-conversion-operational">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-border/60 bg-muted/15 p-3 text-center">
                <p className="text-xs text-muted-foreground">МК, шт.</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{formatUnits(hwOpKpi.mk)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/15 p-3 text-center">
                <p className="text-xs text-muted-foreground">Фурнитура, шт.</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{formatUnits(hwOpKpi.hw)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/15 p-3 text-center">
                <p className="text-xs text-muted-foreground">Средняя конверсия</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{formatPercent(hwOpKpi.avg)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/15 p-3 text-center">
                <p className="text-xs text-muted-foreground">Низкая / нет</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{hwOpKpi.low}</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Структура: МК (база) и фурнитура как доля от суммы отгрузок по выборке</p>
              <div className="flex h-8 w-full overflow-hidden rounded-lg bg-muted">
                <div
                  className="bg-primary/55"
                  title="МК"
                  style={{
                    width: `${hwOpKpi.mk + hwOpKpi.hw > 0 ? Math.round((hwOpKpi.mk / (hwOpKpi.mk + hwOpKpi.hw)) * 100) : 0}%`,
                  }}
                />
                <div
                  className="bg-primary"
                  title="Фурнитура"
                  style={{
                    width: `${hwOpKpi.mk + hwOpKpi.hw > 0 ? Math.round((hwOpKpi.hw / (hwOpKpi.mk + hwOpKpi.hw)) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Слева — доля МК, справа — доля фурнитуры в сумме (МК + фурнитура) по синтетическим строкам клиентской базы.
              </p>
            </div>
          </CardContent>
        </Card>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hwRiskClients.map((r) => (
            <Card
              key={r.dealerId}
              className="min-w-0 rounded-2xl border border-border/80 bg-card shadow-md"
              data-testid={`card-infographic-hardware-risk-${r.dealerId}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base leading-snug">{r.clientName}</CardTitle>
                <p className="text-xs text-muted-foreground">{r.city}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Конверсия:{" "}
                  <span className="font-semibold text-foreground">{formatPercent(r.conversionPercent)}</span> · МК{" "}
                  {formatUnits(r.mkSales)}, фурнитура {formatUnits(r.hardwareSales)}
                </p>
                <p className="text-xs">Конкуренты: {r.competitorsSummary || "—"}</p>
                <p className="text-xs">Модели у конкурентов: {r.topCompetitorModels}</p>
                <p className="text-xs">Причина не у нас: {r.reasonNotWithUs}</p>
                <Button asChild variant="outline" className="w-full min-h-9 border-border bg-card text-xs font-semibold">
                  <Link href={`/dealers/${r.dealerId}`}>Карточка клиента</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-infographic-equipment">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Оборудование</h2>
        <p className="text-sm text-muted-foreground">Суммы и количество по номенклатуре, клиенты с отгрузками оборудования.</p>
        <div className="grid min-w-0 gap-3 sm:grid-cols-4">
          <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
            <CardContent className="p-4 text-center text-sm">
              <p className="text-xs text-muted-foreground">Сумма, ₽</p>
              <p className="mt-1 font-semibold tabular-nums text-foreground">{formatCompactRub(equipmentKpi.sum)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
            <CardContent className="p-4 text-center text-sm">
              <p className="text-xs text-muted-foreground">Кол-во единиц</p>
              <p className="mt-1 font-semibold tabular-nums text-foreground">{equipmentKpi.units}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
            <CardContent className="p-4 text-center text-sm">
              <p className="text-xs text-muted-foreground">Клиентов</p>
              <p className="mt-1 font-semibold tabular-nums text-foreground">{equipmentKpi.clients}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
            <CardContent className="p-4 text-center text-sm">
              <p className="text-xs text-muted-foreground">Средний заказ / мес.</p>
              <p className="mt-1 font-semibold tabular-nums text-foreground">{formatCompactRub(equipmentKpi.avgM)}</p>
            </CardContent>
          </Card>
        </div>
        <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Структура по номенклатуре</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3" data-testid="chart-infographic-equipment">
            {equipmentNomBars.map((b) => (
              <HorizontalBarRow
                key={b.name}
                label={b.name}
                value={b.amountRub}
                max={maxEquipRub}
                valueText={formatCompactRub(b.amountRub)}
                suffix={`${b.quantity} шт.`}
              />
            ))}
          </CardContent>
        </Card>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {equipmentClients.map((c) => (
            <Card
              key={c.dealerId}
              className="min-w-0 rounded-2xl border border-border/80 bg-card shadow-md"
              data-testid={`card-infographic-equipment-client-${c.dealerId}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base leading-snug">{c.clientName}</CardTitle>
                <p className="text-xs text-muted-foreground">{c.city}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Сумма оборудования: <span className="font-semibold text-foreground">{formatCompactRub(c.amountRub)}</span>
                </p>
                <p className="tabular-nums">
                  Единиц: {c.quantity} · средний заказ / мес.: {formatCompactRub(c.avgMonthlyOrderRub)}
                </p>
                <Button asChild variant="outline" className="w-full min-h-9 border-border bg-card text-xs font-semibold">
                  <Link href={`/dealers/${c.dealerId}`}>Карточка клиента</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-infographic-city-segments">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Города и категории клиентов</h2>
        <p className="text-sm text-muted-foreground">
          Доли TOP / A / B / C и вхождение в сегменты витрины; продажи с витрины и конверсия по городу.
        </p>
        <div className="space-y-4" data-testid="chart-infographic-city-segments">
          {citySegments.map((c) => (
            <Card
              key={c.cityId}
              className="min-w-0 rounded-2xl border border-border/80 bg-card shadow-md"
              data-testid={`card-infographic-city-segment-${c.cityId}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{c.cityName}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {c.clients} клиентов · продажи с витрины {formatCompactRub(c.showcaseSales)} · конверсия{" "}
                  {formatPercent(c.avgConversionPercent)}
                </p>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Категории клиентов</p>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted text-[0]">
                    {c.shareTopPercent > 0 ? (
                      <div className="bg-primary" style={{ width: `${c.shareTopPercent}%` }} title={`TOP ${c.shareTopPercent}%`} />
                    ) : null}
                    {c.shareAPercent > 0 ? (
                      <div className="bg-primary/70" style={{ width: `${c.shareAPercent}%` }} title={`A ${c.shareAPercent}%`} />
                    ) : null}
                    {c.shareBPercent > 0 ? (
                      <div className="bg-primary/45" style={{ width: `${c.shareBPercent}%` }} title={`B ${c.shareBPercent}%`} />
                    ) : null}
                    {c.shareCPercent > 0 ? (
                      <div className="bg-muted-foreground/35" style={{ width: `${c.shareCPercent}%` }} title={`C ${c.shareCPercent}%`} />
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    TOP {c.shareTopPercent}% · A {c.shareAPercent}% · B {c.shareBPercent}% · C {c.shareCPercent}%
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Сегменты витрины</p>
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                    {c.shareTop500Percent > 0 ? (
                      <div className="bg-emerald-600/80" style={{ width: `${c.shareTop500Percent}%` }} title="ТОП 500" />
                    ) : null}
                    {c.shareFiveHundredPlusPercent > 0 ? (
                      <div
                        className="bg-sky-600/70"
                        style={{ width: `${c.shareFiveHundredPlusPercent}%` }}
                        title="500+"
                      />
                    ) : null}
                    {c.shareClubPercent > 0 ? (
                      <div className="bg-violet-600/70" style={{ width: `${c.shareClubPercent}%` }} title="Club" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    ТОП 500: {c.shareTop500Percent}% · 500+: {c.shareFiveHundredPlusPercent}% · Club: {c.shareClubPercent}%
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-infographic-showcase-models">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Модели на витринах</h2>
        <p className="text-sm text-muted-foreground">Топ моделей МК и ВХ по синтетическим витринам клиентской базы.</p>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <Card className="min-w-0 rounded-2xl border border-border/80 bg-card shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">МК</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3" data-testid="chart-infographic-showcase-models-mk">
              {modelsMk.map((m) => (
                <div
                  key={m.productId}
                  className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium leading-snug text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Клиентов: {m.clientCount} · продажи с витрины {formatCompactRub(m.showcaseSales)} · конверсия{" "}
                      {formatPercent(m.avgConversionPercent)} · на витрине ~{formatUnits(m.unitsOnShowcase)} шт.
                    </p>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant="secondary"
                    className="shrink-0 font-semibold"
                    data-testid={`button-infographic-open-product-${m.productId}`}
                  >
                    <Link href={`/catalog/${m.productId}`}>К товару</Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="min-w-0 rounded-2xl border border-border/80 bg-card shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">ВХ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3" data-testid="chart-infographic-showcase-models-vh">
              {modelsVh.map((m) => (
                <div
                  key={m.productId}
                  className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium leading-snug text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Клиентов: {m.clientCount} · продажи с витрины {formatCompactRub(m.showcaseSales)} · конверсия{" "}
                      {formatPercent(m.avgConversionPercent)} · на витрине ~{formatUnits(m.unitsOnShowcase)} шт.
                    </p>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant="secondary"
                    className="shrink-0 font-semibold"
                    data-testid={`button-infographic-open-product-${m.productId}`}
                  >
                    <Link href={`/catalog/${m.productId}`}>К товару</Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4" data-testid="section-analytics-infographic-territory">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Структура территории</h2>
        <p className="text-sm text-muted-foreground">Рейтинг городов и доли категорий клиентов без географической карты.</p>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <Card className="min-w-0 rounded-2xl border border-border/80 bg-card shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Города по доле в регионе</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4" data-testid="chart-analytics-territory-cities">
              {cities.map((c) => (
                <HorizontalBarRow
                  key={c.id}
                  label={c.city}
                  value={c.regionSharePercent}
                  max={maxCityShare}
                  valueText={`${c.regionSharePercent}%`}
                  suffix={`${c.clientsCount} клиентов · ${c.topCategory}`}
                />
              ))}
            </CardContent>
          </Card>
          <Card className="min-w-0 rounded-2xl border border-border/80 bg-card shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Доли категорий клиентов</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3" data-testid="chart-analytics-territory-category-share">
              {partnerShares.map((row) => (
                <HorizontalBarRow
                  key={row.label}
                  label={row.label}
                  value={row.share}
                  max={100}
                  valueText={`${row.share}%`}
                  suffix="доля в структуре"
                />
              ))}
              <p className="text-xs text-muted-foreground">Шкала 0–100%: сумма долей по сценарию данных региона.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4" data-testid="section-analytics-infographic-tops">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Топы</h2>
        <div className="grid min-w-0 gap-4 xl:grid-cols-3">
          <Card className="min-w-0 rounded-2xl border border-border/80 bg-card shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Товары, территория</CardTitle>
            </CardHeader>
            <CardContent>
              <TopBars
                items={topsTerritory}
                testId="chart-analytics-top-products-territory"
                subtitle="МК/ВХ — шт., прочее — оборот по выборке"
              />
            </CardContent>
          </Card>
          <Card className="min-w-0 rounded-2xl border border-border/80 bg-card shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Товары, город</CardTitle>
            </CardHeader>
            <CardContent>
              <TopBars
                items={topsCity}
                testId="chart-analytics-top-products-city"
                subtitle="Городской срез (условные доли)"
              />
            </CardContent>
          </Card>
          <Card className="min-w-0 rounded-2xl border border-border/80 bg-card shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Партнёры</CardTitle>
            </CardHeader>
            <CardContent>
              <TopBars items={topsPartners} testId="chart-analytics-top-partners" subtitle="Оборот по партнёру, ₽" />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4" data-testid="section-analytics-infographic-hardware-conversion">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Воронка: фурнитура</h2>
        <p className="text-sm text-muted-foreground">Этапы и доли — обезличенный срез по зоне.</p>
        <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
          <CardContent className="p-4 sm:p-6" data-testid="chart-analytics-hardware-conversion">
            <div className="mx-auto max-w-md space-y-3">
              {funnel.map((step: HardwareConversionFunnelStep, i: number) => {
                const w = step.percent;
                return (
                  <div key={step.id} className="space-y-1">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="font-medium text-foreground">{step.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {step.value} · {formatPercent(step.percent)}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "mx-auto rounded-lg border border-border/60 py-3 text-center text-sm font-semibold text-foreground",
                        i === funnel.length - 1 ? "bg-primary/15" : "bg-muted/40",
                      )}
                      style={{ width: `${Math.max(28, w)}%` }}
                    >
                      {step.percent}%
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
