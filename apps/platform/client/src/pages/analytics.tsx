import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FloatingBackButton } from "@/components/navigation/floating-back-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsInfographicsPanel } from "@/components/analytics/analytics-infographics-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ANALYTICS_CITY_OPTIONS,
  ANALYTICS_PARTNER_CATEGORY_OPTIONS,
  ANALYTICS_PERIOD_OPTIONS,
  ANALYTICS_PRODUCT_LINE_OPTIONS,
  ANALYTICS_TERRITORY_OPTIONS,
  analyticsPeriodSuffix,
  formatCompactRub,
  formatPercent,
  formatRub,
  formatUnits,
  getAnalyticsPlanSummary,
  getCityAnalyticsRows,
  getPartnerCategoryRows,
  getProductCategoryRows,
  getTerritoryAnalytics,
  getTopPartners,
  getTopProducts,
  type AnalyticsFilterState,
  type PartnerCategoryAnalytics,
} from "@/lib/sales-manager-kpi-data";

function toneForChange(p: number) {
  if (p > 0) return "text-emerald-700";
  if (p < 0) return "text-red-700";
  return "text-muted-foreground";
}

export default function AnalyticsPage() {
  const [view, setView] = useState<"summary" | "infographics">("summary");
  const [filters, setFilters] = useState<AnalyticsFilterState>({
    periodKey: "month",
    territoryId: "south",
    cityId: "all",
    partnerCategoryKey: "all",
    productLine: "all",
  });

  const territory = useMemo(() => getTerritoryAnalytics(filters.territoryId), [filters.territoryId]);
  const cities = useMemo(() => getCityAnalyticsRows(filters.cityId), [filters.cityId]);
  const partnerCats = useMemo(
    () => getPartnerCategoryRows(filters.partnerCategoryKey),
    [filters.partnerCategoryKey],
  );
  const productCats = useMemo(() => getProductCategoryRows(filters.productLine), [filters.productLine]);
  const topProducts = useMemo(() => getTopProducts(), []);
  const topPartners = useMemo(() => getTopPartners(), []);
  const planSummary = useMemo(() => getAnalyticsPlanSummary(), []);
  const periodNote = analyticsPeriodSuffix(filters.periodKey);

  return (
    <div className="space-y-8 pb-28 sm:space-y-10" data-testid="page-analytics">
      <section
        className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8"
        data-testid="section-analytics-hero"
      >
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-primary" aria-hidden />
        <div className="relative space-y-4 pl-3 sm:pl-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Аналитика</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Динамика продаж, клиентов, категорий и топов по территории.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="min-h-10 font-semibold" data-testid="button-analytics-open-main">
              <Link href="/main">К главному</Link>
            </Button>
            <Button asChild variant="secondary" className="min-h-10 font-semibold" data-testid="button-analytics-open-orders">
              <Link href="/orders">К заказам</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-10 border-border bg-card font-semibold" data-testid="button-analytics-open-dealers">
              <Link href="/dealer-base">К клиентской базе</Link>
            </Button>
          </div>
        </div>
      </section>

      <Tabs
        value={view}
        onValueChange={(v) => setView(v as "summary" | "infographics")}
        className="w-full min-w-0 space-y-6"
      >
        <TabsList
          data-testid="tabs-analytics-view"
          className="grid h-auto w-full min-w-0 max-w-full grid-cols-2 gap-1 p-1 sm:inline-flex sm:w-auto"
        >
          <TabsTrigger
            value="summary"
            className="min-h-10 flex-1 px-2 text-xs sm:flex-initial sm:text-sm"
            data-testid="tab-analytics-summary"
          >
            Сводка
          </TabsTrigger>
          <TabsTrigger
            value="infographics"
            className="min-h-10 flex-1 px-2 text-xs sm:flex-initial sm:text-sm"
            data-testid="tab-analytics-infographics"
          >
            Инфографика
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6 space-y-8 focus-visible:ring-0" data-testid="section-analytics-summary-view">
      <section className="space-y-4" data-testid="section-analytics-plan-summary">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">План месяца по линейкам</h2>
        <p className="text-sm text-muted-foreground">Период: {planSummary.periodLabel}. МК и ВХ — в штуках, фурнитура — в обороте (₽).</p>
        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
          <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">МК</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{formatPercent(planSummary.mkCompletionPercent)}</p>
              <p className="mt-1 text-xs text-muted-foreground">выполнение плана, шт.</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ВХ</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{formatPercent(planSummary.vhCompletionPercent)}</p>
              <p className="mt-1 text-xs text-muted-foreground">выполнение плана, шт.</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Фурнитура</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{formatPercent(planSummary.hardwareCompletionPercent)}</p>
              <p className="mt-1 text-xs text-muted-foreground">выполнение плана, оборот</p>
            </CardContent>
          </Card>
        </div>
        <Button asChild variant="outline" className="min-h-10 border-border bg-card font-semibold">
          <Link href="/main">К главному</Link>
        </Button>
      </section>

      <section className="space-y-4" data-testid="section-analytics-filters">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Фильтры</h2>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Период</p>
            <Select
              value={filters.periodKey}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, periodKey: v as AnalyticsFilterState["periodKey"] }))
              }
            >
              <SelectTrigger className="min-h-10 w-full min-w-0" data-testid="select-analytics-period">
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
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Территория</p>
            <Select
              value={filters.territoryId}
              onValueChange={(v) => setFilters((f) => ({ ...f, territoryId: v }))}
            >
              <SelectTrigger className="min-h-10 w-full min-w-0" data-testid="select-analytics-territory">
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
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Населённый пункт</p>
            <Select value={filters.cityId} onValueChange={(v) => setFilters((f) => ({ ...f, cityId: v as typeof f.cityId }))}>
              <SelectTrigger className="min-h-10 w-full min-w-0" data-testid="select-analytics-city">
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
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Категория клиента</p>
            <Select
              value={filters.partnerCategoryKey}
              onValueChange={(v) =>
                setFilters((f) => ({
                  ...f,
                  partnerCategoryKey: v as AnalyticsFilterState["partnerCategoryKey"],
                }))
              }
            >
              <SelectTrigger className="min-h-10 w-full min-w-0" data-testid="select-analytics-partner-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANALYTICS_PARTNER_CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-1">
            <p className="text-xs font-medium text-muted-foreground">Линейка (ВХ / МК / фурнитура)</p>
            <Select
              value={filters.productLine}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, productLine: v as AnalyticsFilterState["productLine"] }))
              }
            >
              <SelectTrigger className="min-h-10 w-full min-w-0" data-testid="select-analytics-product-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANALYTICS_PRODUCT_LINE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Сводка {periodNote} · территория «{territory.territoryLabel}»</p>
      </section>

      <section className="space-y-4" data-testid="section-analytics-territory-dynamics">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Динамика по территории</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Продажи</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{formatCompactRub(territory.salesRub)}</p>
              <p className={cn("mt-1 text-sm font-medium", toneForChange(territory.salesChangeVsPrevPercent))}>
                к прошлому периоду: {territory.salesChangeVsPrevPercent > 0 ? "+" : ""}
                {territory.salesChangeVsPrevPercent}%
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Заказы</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{territory.ordersCount}</p>
              <p className="mt-1 text-sm text-muted-foreground">оформлено за выбранный период</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Активные клиенты</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{territory.activeClients}</p>
              <p className="mt-1 text-sm text-muted-foreground">с отгрузками в периоде</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Средний заказ</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums text-foreground">{formatRub(territory.avgOrderRub)}</p>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/80 bg-card shadow-md sm:col-span-2 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Валовая выручка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-2xl font-semibold tabular-nums text-foreground">{formatCompactRub(territory.grossRub)}</p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, Math.round((territory.grossRub / territory.salesRub) * 100))}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Доля валовки относительно отгрузок по территории (условная шкала)</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4" data-testid="section-analytics-city-breakdown">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Населённые пункты</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {cities.map((c) => (
              <Card
                key={c.cityId}
                className="min-w-0 rounded-2xl border border-border/80 bg-card shadow-md"
                data-testid={`card-analytics-city-${c.cityId}`}
              >
                <CardHeader className="space-y-1 pb-2">
                  <CardTitle className="text-base">{c.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{c.partnerCategoriesLabel}</p>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="tabular-nums">
                      Доля в регионе: {c.shareInRegionPercent}%
                    </Badge>
                    <Badge variant="outline" className={cn("tabular-nums", toneForChange(c.changeVsPrevPercent))}>
                      Динамика: {c.changeVsPrevPercent > 0 ? "+" : ""}
                      {c.changeVsPrevPercent}%
                    </Badge>
                  </div>
                  <p>
                    <span className="text-muted-foreground">Общий оборот по городу:</span>{" "}
                    <span className="font-semibold text-foreground">{formatCompactRub(c.salesRub)}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Клиентов:</span>{" "}
                    <span className="font-semibold tabular-nums text-foreground">{c.clientCount}</span>
                  </p>
                  <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/15 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Структура (разные единицы)</p>
                    <p className="tabular-nums text-foreground">
                      ВХ: <span className="font-semibold">{formatUnits(c.vhUnits)}</span>
                    </p>
                    <p className="tabular-nums text-foreground">
                      МК: <span className="font-semibold">{formatUnits(c.mkUnits)}</span>
                    </p>
                    <p className="tabular-nums text-foreground">
                      Фурнитура (оборот): <span className="font-semibold">{formatCompactRub(c.hardwareTurnoverRub)}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-analytics-partner-categories">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Категории клиентов</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {partnerCats.map((p: PartnerCategoryAnalytics) => (
            <Card key={p.key} className="rounded-2xl border border-border/80 bg-card shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{p.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground">{p.count}</span> партнёров · доля {p.sharePercent}%
                </p>
                <p>
                  Продажи: <span className="font-semibold">{formatCompactRub(p.salesRub)}</span>
                </p>
                <p className={cn("font-medium", toneForChange(p.changeVsPrevPercent))}>
                  Динамика: {p.changeVsPrevPercent > 0 ? "+" : ""}
                  {p.changeVsPrevPercent}%
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-analytics-product-categories">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">ВХ · МК · Фурнитура</h2>
        <p className="text-sm text-muted-foreground">ВХ и МК — план и факт в штуках; фурнитура — план и факт в обороте (₽).</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {productCats.map((p) => (
            <Card key={p.line} className="rounded-2xl border border-border/80 bg-card shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{p.line}</CardTitle>
                <p className="text-xs text-muted-foreground">{p.metric === "units" ? "Учёт: шт." : "Учёт: оборот, ₽"}</p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  План:{" "}
                  <span className="font-semibold text-foreground">
                    {p.metric === "units" ? formatUnits(p.plan) : formatCompactRub(p.plan)}
                  </span>
                </p>
                <p>
                  Факт:{" "}
                  <span className="font-semibold text-foreground">
                    {p.metric === "units" ? formatUnits(p.fact) : formatCompactRub(p.fact)}
                  </span>
                </p>
                <p className={cn("font-medium", toneForChange(p.changeVsPrevPercent))}>
                  Динамика: {p.changeVsPrevPercent > 0 ? "+" : ""}
                  {p.changeVsPrevPercent}%
                </p>
                <p>
                  Конверсия в заказе: <span className="font-semibold text-foreground">{formatPercent(p.conversionPercent)}</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4" data-testid="section-analytics-sales-tops">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Топы продаж</h2>
        <p className="text-sm text-muted-foreground">
          Топы по территории и по выбранному городу; вклад в общий результат и конверсия по связанным заказам.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Товары</h3>
            {topProducts.map((p) => (
              <Card
                key={p.productId}
                className="rounded-2xl border border-border/80 bg-card shadow-md"
                data-testid={`card-analytics-top-product-${p.productId}`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base leading-snug">{p.name}</CardTitle>
                  <p className="font-mono text-xs text-muted-foreground">{p.article}</p>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    Оборот по территории: <span className="font-semibold text-foreground">{formatCompactRub(p.territorySalesRub)}</span>
                  </p>
                  <p>
                    Оборот по городу (срез): <span className="font-semibold text-foreground">{formatCompactRub(p.citySalesRub)}</span>
                  </p>
                  {p.territoryUnits != null && p.cityUnits != null ? (
                    <p className="tabular-nums">
                      Отбор в штуках: <span className="font-semibold text-foreground">{formatUnits(p.territoryUnits)}</span> по
                      территории, <span className="font-semibold text-foreground">{formatUnits(p.cityUnits)}</span> по городу
                    </p>
                  ) : null}
                  <p className="tabular-nums">Вклад в результат: ~{p.contributionPercent}%</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Клиенты</h3>
            {topPartners.map((p) => (
              <Card
                key={p.dealerId}
                className="rounded-2xl border border-border/80 bg-card shadow-md"
                data-testid={`card-analytics-top-partner-${p.dealerId}`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base leading-snug">{p.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{p.city}</p>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Продажи: <span className="font-semibold text-foreground">{formatCompactRub(p.salesRub)}</span> · вклад ~{p.contributionPercent}%
                  </p>
                  <p className="text-xs text-muted-foreground">{p.conversionHint}</p>
                  <Button asChild variant="outline" className="w-full min-h-10 border-border bg-card font-semibold">
                    <Link href={`/dealers/${p.dealerId}`}>Карточка клиента</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <Card className="rounded-2xl border border-border/80 bg-card shadow-md">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Конверсия по топам: суммарный вклад топ-3 товаров и топ-3 клиентов в отгрузки региона оценивается примерно в{" "}
            <span className="font-semibold text-foreground">19%</span> при стабильной доле фурнитуры в заказах топ-клиентов.
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4" data-testid="section-analytics-quick-actions">
        <h2 className="text-lg font-semibold text-foreground sm:text-xl">Быстрые переходы</h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="min-h-10 font-semibold">
            <Link href="/orders">Заказы</Link>
          </Button>
          <Button asChild variant="secondary" className="min-h-10 font-semibold">
            <Link href="/dealer-base">Клиенты</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-10 border-border bg-card font-semibold">
            <Link href="/catalog">Каталог</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-10 border-border bg-card font-semibold">
            <Link href="/tasks">Задачи</Link>
          </Button>
        </div>
      </section>

        </TabsContent>

        <TabsContent
          value="infographics"
          className="mt-6 space-y-8 focus-visible:ring-0"
          data-testid="section-analytics-infographics-view"
        >
          <AnalyticsInfographicsPanel />
        </TabsContent>
      </Tabs>

      <FloatingBackButton href="/main" label="К главному" testId="floating-back-to-main" ariaLabel="К главному" />
    </div>
  );
}
