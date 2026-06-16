import type { ReactElement } from "react";
import { Link } from "wouter";
import type { ProductAnalyticsRow } from "@/lib/distribution-analytics/distribution-analytics-view-models";
import type { DistributionGroupMetrics, EquipmentTypeKey } from "@/lib/distribution-analytics/distribution-analytics-math";
import { buildHashPath } from "@/lib/hash-route-utils";
import { DistributionAnalyticsKpiTiles, DistributionPercentBadge } from "./distribution-analytics-kpi-tiles";
import { formatDistributionPercent } from "@/lib/distribution-analytics/distribution-analytics-math";

type Props = {
  productRows: ProductAnalyticsRow[];
  aggregate: DistributionGroupMetrics;
  filtersEncoded?: string;
  activeEquipmentTypes?: EquipmentTypeKey[];
};

const TYPE_LABEL = { entrance: "ВХ", interior: "МК", hardware: "Фурнитура" } as const;

export function DistributionAnalyticsTabProduct({
  productRows,
  aggregate,
  filtersEncoded,
  activeEquipmentTypes = [],
}: Props): ReactElement {
  return (
    <div className="space-y-3" data-testid="distribution-analytics-tab-product">
      <DistributionAnalyticsKpiTiles
        aggregate={aggregate}
        tradePointsCount={aggregate.tradePointsCount}
        activeEquipmentTypes={activeEquipmentTypes}
      />

      <div className="overflow-x-auto rounded-xl border border-border/70">
        <table className="min-w-[960px] w-full text-left text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2">Фото</th>
              <th className="px-2 py-2">Модель</th>
              <th className="px-2 py-2">Тип</th>
              <th className="px-2 py-2">Где стоит (ТТ)</th>
              <th className="px-2 py-2">Покрытие</th>
              <th className="px-2 py-2">TOP-150</th>
              <th className="px-2 py-2">TOP-350</th>
              <th className="px-2 py-2">Топ-3 города</th>
            </tr>
          </thead>
          <tbody>
            {productRows.map((row) => (
              <tr key={row.product.id} className="border-t border-border/50 hover:bg-muted/20">
                <td className="px-2 py-2">
                  {row.product.image ? (
                    <img src={row.product.image} alt="" className="h-8 w-8 rounded object-contain" />
                  ) : (
                    <div className="h-8 w-8 rounded bg-muted" />
                  )}
                </td>
                <td className="px-2 py-2">
                  <Link
                    href={buildHashPath(`/model/${encodeURIComponent(row.product.id)}`, {
                      fromFilters: filtersEncoded ?? "",
                    })}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.product.name}
                  </Link>
                  <p className="text-[10px] text-muted-foreground">{row.product.id}</p>
                </td>
                <td className="px-2 py-2">{TYPE_LABEL[row.modelType]}</td>
                <td className="px-2 py-2 tabular-nums">{row.coverage.presentTradePoints}</td>
                <td className="px-2 py-2">
                  <DistributionPercentBadge value={row.coverage.coveragePercent} />
                </td>
                <td className="px-2 py-2">{formatDistributionPercent(row.coverageTop150.coveragePercent)}</td>
                <td className="px-2 py-2">{formatDistributionPercent(row.coverageTop350.coveragePercent)}</td>
                <td className="px-2 py-2 text-[10px] text-muted-foreground">
                  {row.topCities.map((c) => `${c.city} ${formatDistributionPercent(c.coveragePercent)}`).join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
