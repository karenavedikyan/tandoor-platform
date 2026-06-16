import type { ReactElement } from "react";
import { Fragment, useMemo, useState } from "react";
import type { TerritoryRegionRow } from "@/lib/distribution-analytics/distribution-analytics-view-models";
import type { DistributionGroupMetrics, EquipmentTypeKey } from "@/lib/distribution-analytics/distribution-analytics-math";
import { DistributionAnalyticsKpiTiles, DistributionPercentBadge } from "./distribution-analytics-kpi-tiles";
import { DistributionEmptyDataNotice } from "./distribution-empty-data-notice";
import { cn } from "@/lib/utils";

type Props = {
  territoryRows: TerritoryRegionRow[];
  aggregate: DistributionGroupMetrics;
  activeEquipmentTypes?: EquipmentTypeKey[];
  totalRowsInScope: number;
  hasAnyEligible: boolean;
};

export function DistributionAnalyticsTabTerritory({
  territoryRows,
  aggregate,
  activeEquipmentTypes = [],
  totalRowsInScope,
  hasAnyEligible,
}: Props): ReactElement {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    if (territoryRows.length === 1) init[territoryRows[0]!.region] = true;
    return init;
  });

  const cityCount = useMemo(() => territoryRows.reduce((n, r) => n + r.cities.length, 0), [territoryRows]);

  return (
    <div className="space-y-3" data-testid="distribution-analytics-tab-territory">
      <DistributionAnalyticsKpiTiles
        aggregate={aggregate}
        tradePointsCount={aggregate.tradePointsCount}
        activeEquipmentTypes={activeEquipmentTypes}
      />

      <DistributionEmptyDataNotice hasAnyEligible={hasAnyEligible} totalRowsInScope={totalRowsInScope} />

      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="min-w-[880px] w-full text-left text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2">Регион / Город</th>
              <th className="px-2 py-2">ТТ</th>
              <th className="px-2 py-2">ВХ %</th>
              <th className="px-2 py-2">МК %</th>
              <th className="px-2 py-2">Фурн %</th>
              <th className="px-2 py-2">Средняя %</th>
            </tr>
          </thead>
          <tbody>
            {territoryRows.map((region) => (
              <Fragment key={region.region}>
                <tr key={region.region} className="border-t border-border/50 bg-muted/10">
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="font-semibold text-foreground"
                      onClick={() => setExpanded((e) => ({ ...e, [region.region]: !e[region.region] }))}
                    >
                      {expanded[region.region] ? "▾" : "▸"} {region.region}
                    </button>
                  </td>
                  <td className="px-2 py-2">{region.metrics.tradePointsCount}</td>
                  <MetricCells metrics={region.metrics} />
                </tr>
                {expanded[region.region]
                  ? region.cities.map((city) => (
                      <tr key={`${region.region}:${city.city}`} className="border-t border-border/30">
                        <td className="px-2 py-2 pl-6 text-muted-foreground">{city.city}</td>
                        <td className="px-2 py-2">{city.metrics.tradePointsCount}</td>
                        <MetricCells metrics={city.metrics} />
                      </tr>
                    ))
                  : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {cityCount > 0 && cityCount <= 12 ? (
        <div className="space-y-2 rounded-xl border border-border/70 bg-card p-3" data-testid="distribution-analytics-territory-chart">
          <p className="text-xs font-semibold">Средняя дистрибуция по городам</p>
          <div className="flex items-end gap-2 overflow-x-auto pb-1">
            {territoryRows.flatMap((r) =>
              r.cities.map((city) => {
                const pct = city.metrics.averagePercent ?? 0;
                return (
                  <div key={`${r.region}:${city.city}`} className="flex min-w-[56px] flex-col items-center gap-1">
                    <div
                      className={cn("w-10 rounded-t bg-primary/70")}
                      style={{ height: `${Math.max(8, Math.min(120, pct * 1.2))}px` }}
                      title={`${city.city}: ${pct.toFixed(0)}%`}
                    />
                    <span className="max-w-[72px] truncate text-[9px] text-muted-foreground">{city.city}</span>
                  </div>
                );
              }),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCells({ metrics }: { metrics: DistributionGroupMetrics }): ReactElement {
  return (
    <>
      <td className="px-2 py-2">
        <DistributionPercentBadge value={metrics.byType.entrance.percent} />
        <p className="text-[10px] text-muted-foreground">
          {metrics.byType.entrance.tandoorOnShelf}/{metrics.byType.entrance.capacity}
        </p>
      </td>
      <td className="px-2 py-2">
        <DistributionPercentBadge value={metrics.byType.interior.percent} />
        <p className="text-[10px] text-muted-foreground">
          {metrics.byType.interior.tandoorOnShelf}/{metrics.byType.interior.capacity}
        </p>
      </td>
      <td className="px-2 py-2">
        <DistributionPercentBadge value={metrics.byType.hardware.percent} />
        <p className="text-[10px] text-muted-foreground">
          {metrics.byType.hardware.tandoorOnShelf}/{metrics.byType.hardware.capacity}
        </p>
      </td>
      <td className="px-2 py-2">
        <DistributionPercentBadge value={metrics.averagePercent} />
      </td>
    </>
  );
}
