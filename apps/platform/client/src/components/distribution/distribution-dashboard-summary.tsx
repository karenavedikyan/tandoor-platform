import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  collectScopeTradePoints,
  type DistributionScope,
} from "@/lib/distribution-tree-data";
import {
  computeNetworkSummary,
  listDeficitPositions,
  staleTradePoints,
  topWorstModels,
  topWorstTradePoints,
  type DeficitPositionItem,
  type DistributionAnalyticsRow,
} from "@/lib/distribution-analytics";
import { useDistributionAnalytics } from "@/lib/distribution-analytics-store";
import { createFilteredMetricsContextBuilder, type DistributionFilterState } from "@/lib/distribution-filters";
import { formatRelativeTime } from "@/lib/format-datetime";

type DistributionDashboardSummaryProps = {
  scope: DistributionScope;
  filter: DistributionFilterState;
};

const STALE_DAYS = 30;
const PREVIEW_LIMIT = 5;

function formatPct(value: number | null): string {
  return value == null ? "—" : `${value}%`;
}

function pctTone(value: number | null): string {
  if (value == null) return "text-muted-foreground";
  if (value >= 80) return "text-emerald-700 dark:text-emerald-300";
  if (value >= 50) return "text-foreground";
  return "text-amber-800 dark:text-amber-200";
}

function KpiCard({
  title,
  value,
  hint,
  pct,
  loading,
  testId,
}: {
  title: string;
  value: string;
  hint: string;
  pct: number | null;
  loading: boolean;
  testId: string;
}) {
  const progress = pct == null ? 0 : Math.min(100, Math.max(0, pct));
  return (
    <Card className="rounded-xl border border-border bg-card shadow-xs" data-testid={testId}>
      <CardContent className="space-y-2 p-4">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className={cn("text-2xl font-semibold tabular-nums tracking-tight", pctTone(pct))}>{value}</p>
        )}
        <p className="text-xs text-muted-foreground">{hint}</p>
        {!loading && pct != null ? <Progress value={progress} className="h-1.5" /> : null}
      </CardContent>
    </Card>
  );
}

function InsightList<T>({
  title,
  rows,
  renderRow,
  emptyLabel,
  testId,
  onSelect,
}: {
  title: string;
  rows: readonly T[];
  renderRow: (row: T, index: number) => ReactNode;
  emptyLabel: string;
  testId: string;
  onSelect?: (row: T) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, PREVIEW_LIMIT);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card className="rounded-xl border border-border bg-card shadow-xs" data-testid={testId}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {rows.length > PREVIEW_LIMIT ? (
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {expanded ? "Свернуть" : "Показать все"}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
          ) : null}
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground">{emptyLabel}</p>
          ) : (
            <ul className="space-y-1">
              {visible.map((row, index) => (
                <li key={index}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted/50"
                    onClick={() => onSelect?.(row)}
                    data-testid={`${testId}-row-${index}`}
                  >
                    {renderRow(row, index)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </Collapsible>
  );
}

export function DistributionDashboardSummary({ scope, filter }: DistributionDashboardSummaryProps) {
  const { snapshot } = useDistributionAnalytics(scope);

  const refs = useMemo(() => collectScopeTradePoints(scope), [scope]);

  const ctxBuilder = useMemo(
    () => createFilteredMetricsContextBuilder(filter),
    [filter],
  );

  const summary = useMemo(() => {
    return computeNetworkSummary(refs, ctxBuilder);
  }, [refs, ctxBuilder, snapshot]);

  const worstTp = useMemo(
    () => topWorstTradePoints(refs, ctxBuilder, PREVIEW_LIMIT),
    [refs, ctxBuilder, snapshot],
  );
  const worstModels = useMemo(
    () => topWorstModels(refs, ctxBuilder, PREVIEW_LIMIT),
    [refs, ctxBuilder, snapshot],
  );
  const stale = useMemo(
    () => staleTradePoints(refs, ctxBuilder, STALE_DAYS).slice(0, PREVIEW_LIMIT),
    [refs, ctxBuilder, snapshot],
  );
  const deficits = useMemo(
    () => listDeficitPositions(refs, ctxBuilder).slice(0, PREVIEW_LIMIT),
    [refs, ctxBuilder, snapshot],
  );

  const loading = snapshot.loading;
  const sparseData =
    !loading && summary.tradePointsTotal > 0 && summary.tradePointsWithData === 0;

  const freshnessLabel = summary.lastUpdatedAt
    ? formatRelativeTime(summary.lastUpdatedAt)
    : "нет данных";

  const handleSelectTp = (_row: DistributionAnalyticsRow) => {
    /* drill-down во вкладках-разрезах — следующий промт */
  };

  const handleSelectDeficit = (_row: DeficitPositionItem) => {
    /* drill-down во вкладках-разрезах — следующий промт */
  };

  return (
    <div className="space-y-4" data-testid="distribution-dashboard-summary">
      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка сводки…</p>
      ) : null}

      {sparseData ? (
        <Card className="rounded-xl border border-dashed border-border bg-muted/10 shadow-none">
          <CardContent className="px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Данные ещё наполняются менеджерами. Сводка появится, когда по точкам появятся записи матрицы.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <KpiCard
          title="Покрытие данными"
          value={
            loading
              ? "—"
              : `${formatPct(summary.dataCoveragePct)} · ${summary.tradePointsWithData}/${summary.tradePointsTotal}`
          }
          hint="Торговые точки с хотя бы одной записью в матрице"
          pct={summary.dataCoveragePct}
          loading={loading}
          testId="kpi-distribution-data-coverage"
        />
        <KpiCard
          title="ЧД (численная)"
          value={loading ? "—" : `${formatPct(summary.quantitativePct)} · ${summary.factCount}/${summary.planCount}`}
          hint="Факт к плану по позициям матрицы"
          pct={summary.quantitativePct}
          loading={loading}
          testId="kpi-distribution-quantitative"
        />
        <KpiCard
          title="КД (качественная)"
          value={loading ? "—" : formatPct(summary.qualitativePct)}
          hint="С учётом value_weight позиций плана"
          pct={summary.qualitativePct}
          loading={loading}
          testId="kpi-distribution-qualitative"
        />
        <KpiCard
          title="Дефицит"
          value={loading ? "—" : String(summary.deficitCount)}
          hint="Позиций не хватает на витрине"
          pct={
            summary.planCount > 0
              ? Math.round((summary.deficitCount / summary.planCount) * 100)
              : null
          }
          loading={loading}
          testId="kpi-distribution-deficit"
        />
        <KpiCard
          title="Свежесть"
          value={loading ? "—" : freshnessLabel}
          hint="Последнее обновление записей в скоупе"
          pct={null}
          loading={loading}
          testId="kpi-distribution-freshness"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Куда смотреть</p>
        <div className="grid gap-3 lg:grid-cols-2">
          <InsightList
            title="Худшие торговые точки"
            rows={worstTp}
            emptyLabel="Нет точек с отставанием по выбранным фильтрам"
            testId="insight-worst-tradepoints"
            onSelect={handleSelectTp}
            renderRow={(row) => (
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{row.label}</span>
                <Badge variant="outline" className="tabular-nums">
                  {formatPct(row.coverage.quantitativePct)}
                </Badge>
              </span>
            )}
          />
          <InsightList
            title="Устаревшие данные"
            rows={stale}
            emptyLabel="Нет точек со старыми данными"
            testId="insight-stale-tradepoints"
            onSelect={handleSelectTp}
            renderRow={(row) => (
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{row.label}</span>
                <span className="text-muted-foreground">
                  {row.coverage.lastUpdatedAt
                    ? formatRelativeTime(row.coverage.lastUpdatedAt)
                    : "нет данных"}
                </span>
              </span>
            )}
          />
          <InsightList
            title="Дефицит позиций"
            rows={deficits}
            emptyLabel="Дефицит не найден"
            testId="insight-deficit-positions"
            onSelect={handleSelectDeficit}
            renderRow={(row) => (
              <span className="block">
                <span className="font-medium text-foreground">{row.productName}</span>
                <span className="mt-0.5 block text-muted-foreground">
                  {row.dealerName} · {row.tradePointName}
                </span>
              </span>
            )}
          />
          {worstModels.length > 0 ? (
            <InsightList
              title="Худшие модели"
              rows={worstModels}
              emptyLabel="Нет моделей с отставанием"
              testId="insight-worst-models"
              renderRow={(row) => (
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{row.label}</span>
                  <Badge variant="outline" className="tabular-nums">
                    {formatPct(row.coverage.quantitativePct)}
                  </Badge>
                </span>
              )}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
