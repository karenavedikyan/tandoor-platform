import type { ReactElement } from "react";
import type { ModelCoverageMetrics } from "@/lib/distribution-analytics/distribution-analytics-math";
import { DistributionPercentBadge } from "@/components/distribution-analytics/distribution-analytics-kpi-tiles";
import { formatDistributionPercent } from "@/lib/distribution-analytics/distribution-analytics-math";

type Props = {
  coverage: ModelCoverageMetrics;
  coverageTop150: ModelCoverageMetrics;
  coverageTop350: ModelCoverageMetrics;
  citiesCount: number;
};

export function ModelCardKpiTiles({ coverage, coverageTop150, coverageTop350, citiesCount }: Props): ReactElement {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="model-card-kpi-tiles">
      <Tile
        title="Покрытие всего"
        value={formatDistributionPercent(coverage.coveragePercent)}
        hint={`${coverage.presentTradePoints} / ${coverage.eligibleTradePoints} ТТ`}
        badge={coverage.coveragePercent}
      />
      <Tile title="Покрытие в TOP-150" value={formatDistributionPercent(coverageTop150.coveragePercent)} hint={`${coverageTop150.presentTradePoints} / ${coverageTop150.eligibleTradePoints}`} badge={coverageTop150.coveragePercent} />
      <Tile title="Покрытие в TOP-350" value={formatDistributionPercent(coverageTop350.coveragePercent)} hint={`${coverageTop350.presentTradePoints} / ${coverageTop350.eligibleTradePoints}`} badge={coverageTop350.coveragePercent} />
      <Tile title="Городов где стоит" value={String(citiesCount)} hint="Уникальных городов с моделью" />
    </div>
  );
}

function Tile({
  title,
  value,
  hint,
  badge,
}: {
  title: string;
  value: string;
  hint: string;
  badge?: number | null;
}): ReactElement {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        {badge != null ? <DistributionPercentBadge value={badge} /> : null}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}
