import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  buildAnalyticsFilterContext,
  periodWindowIso,
  type DistributionFilterState,
} from "@/lib/distribution-filters";
import { buildDistributionTrend, type TrendBucket } from "@/lib/distribution-trend";
import { loadScopeMatrixEvents } from "@/lib/distribution-trend-loader";
import { collectScopeTradePoints, type DistributionScope } from "@/lib/distribution-tree-data";
import type { ShowcaseMatrixEventDto } from "@/lib/showcase-matrix-api";

type DistributionTrendTabProps = {
  scope: DistributionScope;
  filter: DistributionFilterState;
};

const chartConfig = {
  cumulativeInstalled: {
    label: "Накопительно установлено",
    color: "hsl(var(--primary))",
  },
  installEvents: {
    label: "Установки за период",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

function filterEventsForTab(
  events: readonly ShowcaseMatrixEventDto[],
  filter: DistributionFilterState,
): ShowcaseMatrixEventDto[] {
  const { fromIso, toIso } = periodWindowIso(filter.period);
  const analytics = buildAnalyticsFilterContext(filter);

  return events.filter((e) => {
    const at = e.changedAt?.trim();
    if (!at) return false;
    if (fromIso && at < fromIso) return false;
    if (toIso && at > toIso) return false;
    if (analytics.status !== "all") {
      if (e.newStatus !== analytics.status && e.oldStatus !== analytics.status) return false;
    }
    return true;
  });
}

export function DistributionTrendTab({ scope, filter }: DistributionTrendTabProps) {
  const refs = useMemo(() => collectScopeTradePoints(scope), [scope]);
  const [bucket, setBucket] = useState<TrendBucket>("day");
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<ShowcaseMatrixEventDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadScopeMatrixEvents(refs)
      .then((loaded) => {
        if (!cancelled) setEvents(loaded);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refs]);

  const eventsFiltered = useMemo(
    () => filterEventsForTab(events, filter),
    [events, filter],
  );

  const trend = useMemo(
    () => buildDistributionTrend(eventsFiltered, bucket),
    [eventsFiltered, bucket],
  );

  return (
    <Card className="rounded-xl border border-border bg-card shadow-xs" data-testid="distribution-trend-tab">
      <CardHeader className="space-y-3 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">Динамика покрытия</CardTitle>
          <Tabs
            value={bucket}
            onValueChange={(v) => setBucket(v as TrendBucket)}
            className="w-auto"
          >
            <TabsList className="h-8 gap-1 bg-muted/50 p-0.5">
              <TabsTrigger
                value="day"
                className="h-7 px-2.5 text-xs"
                data-testid="distribution-trend-bucket-day"
              >
                День
              </TabsTrigger>
              <TabsTrigger
                value="week"
                className="h-7 px-2.5 text-xs"
                data-testid="distribution-trend-bucket-week"
              >
                Неделя
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <p className="text-xs text-muted-foreground">
          Тренд по событиям изменения матрицы в текущем скоупе и фильтрах
        </p>
      </CardHeader>
      <CardContent className="px-2 pb-4 sm:px-4">
        {loading ? (
          <div className="space-y-2 px-2">
            <Skeleton className="h-[min(280px,50vw)] w-full" />
          </div>
        ) : trend.length === 0 ? (
          <div
            className="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-12 text-center"
            data-testid="distribution-trend-empty"
          >
            <p className="text-sm text-muted-foreground">Пока нет данных для тренда</p>
            <p className="mt-1 text-xs text-muted-foreground">
              События накапливаются по мере ввода факта по торговым точкам
            </p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-[2/1] min-h-[240px] w-full">
            <ComposedChart data={trend} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="bucketLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
              />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={40}
                allowDecimals={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                yAxisId="right"
                dataKey="installEvents"
                fill="var(--color-installEvents)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="cumulativeInstalled"
                stroke="var(--color-cumulativeInstalled)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
