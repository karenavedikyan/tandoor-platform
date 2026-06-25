import type { ReactElement } from "react";
import { DistributionAnalyticsKpiTiles } from "@/components/distribution-analytics/distribution-analytics-kpi-tiles";
import type { DistributionGroupMetrics } from "@/lib/distribution-analytics/distribution-analytics-math";
import type { DealerBaseAccessRole } from "@/lib/dealer-base-role-views";

const TITLE_BY_ACCESS: Record<DealerBaseAccessRole, string> = {
  sales_manager: "Моя дистрибуция",
  team_lead: "Дистрибуция команды",
  sales_director: "Дистрибуция по региону",
};

type Props = {
  access: DealerBaseAccessRole;
  aggregate: DistributionGroupMetrics;
  tradePointsCount: number;
  /** Префикс для data-testid плиток, чтобы не конфликтовать между разделами. */
  testIdPrefix: string;
  /** Показывать ли плитку «ТТ в выборке». По умолчанию false (как у менеджера сейчас). */
  showTradePointsCount?: boolean;
};

export function RoleDistributionSummaryBar({
  access,
  aggregate,
  tradePointsCount,
  testIdPrefix,
  showTradePointsCount = false,
}: Props): ReactElement {
  return (
    <section className="space-y-2" data-testid={`section-${testIdPrefix}-distribution`}>
      <h2 className="text-sm font-semibold text-foreground">{TITLE_BY_ACCESS[access]}</h2>
      <DistributionAnalyticsKpiTiles
        aggregate={aggregate}
        tradePointsCount={tradePointsCount}
        showTradePointsCount={showTradePointsCount}
        tileTestIdByType={{
          entrance: `tile-${testIdPrefix}-distribution-entrance`,
          interior: `tile-${testIdPrefix}-distribution-interior`,
          hardware: `tile-${testIdPrefix}-distribution-hardware`,
        }}
      />
    </section>
  );
}
