import type { ReactElement } from "react";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { useTradePointDistributionAggregate } from "@/hooks/use-trade-point-distribution-aggregate";
import { DistributionPercentBadge } from "@/components/distribution-analytics/distribution-analytics-kpi-tiles";
import { BrandDistributionLoader } from "@/components/distribution/brand-distribution-loader";

type Props = {
  externalKeys: string[];
  act: ActualizationState;
  testId: string;
};

export function CompactDistributionBadge({
  externalKeys,
  act,
  testId,
}: Props): ReactElement | null {
  if (externalKeys.length === 0) return null;

  return (
    <CompactDistributionBadgeBody externalKeys={externalKeys} act={act} testId={testId} />
  );
}

function CompactDistributionBadgeBody({
  externalKeys,
  act,
  testId,
}: Props): ReactElement {
  const { aggregate, loading } = useTradePointDistributionAggregate(
    externalKeys,
    act,
    undefined,
    { skipInternalPrefetch: false },
  );

  if (loading) {
    return (
      <span data-testid={`${testId}-loading`}>
        <BrandDistributionLoader size="sm" />
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
      data-testid={testId}
    >
      <span>Дистр</span>
      <DistributionPercentBadge value={aggregate.averagePercent} />
    </span>
  );
}
