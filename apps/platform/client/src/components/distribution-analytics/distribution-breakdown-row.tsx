import type { ReactElement } from "react";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { useTradePointDistributionAggregate } from "@/hooks/use-trade-point-distribution-aggregate";
import { DistributionPercentBadge } from "@/components/distribution-analytics/distribution-analytics-kpi-tiles";
import { DistributionRotationBadge } from "@/components/distribution-analytics/distribution-rotation-tile";

type Props = {
  /** Заголовок строки (имя менеджера или название города). */
  label: string;
  /** ТТ, входящие в эту строку. */
  tradePointIds: string[];
  act: ActualizationState;
  testId?: string;
};

/**
 * Строка разреза дистрибуции: один заголовок + средний % дистрибуции (бейдж со светофором).
 * Каждый экземпляр сам вызывает useTradePointDistributionAggregate (один хук на строку) —
 * это допустимо, т.к. список строк рендерится через .map() с отдельным компонентом на строку.
 */
export function DistributionBreakdownRow({ label, tradePointIds, act, testId }: Props): ReactElement {
  const { aggregate, tradePointsCount } = useTradePointDistributionAggregate(tradePointIds, act);
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2"
      data-testid={testId}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">ТТ: {tradePointsCount}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <DistributionRotationBadge
          count={aggregate.totalLegacyOurs}
          percent={aggregate.rotationPotentialPercent}
          testId={testId ? `${testId}-rotation` : undefined}
        />
        <DistributionPercentBadge value={aggregate.averagePercent} />
      </div>
    </div>
  );
}
