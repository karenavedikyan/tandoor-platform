import { memo, type ReactElement } from "react";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import {
  ALL_EQUIPMENT_TYPES,
  type EquipmentTypeKey,
} from "@/lib/distribution-analytics/distribution-analytics-math";
import { useTradePointDistributionAggregate } from "@/hooks/use-trade-point-distribution-aggregate";
import {
  DISTRIBUTION_TYPE_MINI_LABEL,
  DistributionPercentBadge,
} from "@/components/distribution-analytics/distribution-analytics-kpi-tiles";
import { DistributionRotationBadge } from "@/components/distribution-analytics/distribution-rotation-tile";
import { BrandDistributionLoader } from "@/components/distribution/brand-distribution-loader";

type Props = {
  externalKeys: string[];
  act: ActualizationState;
  showcaseUuidByMatrixKey?: ReadonlyMap<string, string>;
  prefetching: boolean;
  testId?: string;
};

export const ManagerDistributionMiniBar = memo(function ManagerDistributionMiniBar({
  externalKeys,
  act,
  showcaseUuidByMatrixKey,
  prefetching,
  testId,
}: Props): ReactElement | null {
  if (externalKeys.length === 0) return null;

  return (
    <ManagerDistributionMiniBarBody
      externalKeys={externalKeys}
      act={act}
      showcaseUuidByMatrixKey={showcaseUuidByMatrixKey}
      prefetching={prefetching}
      testId={testId}
    />
  );
});

function ManagerDistributionMiniBarBody({
  externalKeys,
  act,
  showcaseUuidByMatrixKey,
  prefetching,
  testId,
}: Props): ReactElement {
  const { aggregate, loading } = useTradePointDistributionAggregate(
    externalKeys,
    act,
    showcaseUuidByMatrixKey,
    { skipInternalPrefetch: true, externalPrefetching: prefetching },
  );

  if (loading) {
    return (
      <div data-testid={testId ? `${testId}-loading` : undefined}>
        <BrandDistributionLoader size="sm" />
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 text-[10px]"
      data-testid={testId}
    >
      {ALL_EQUIPMENT_TYPES.map((type: EquipmentTypeKey) => (
        <span key={type} className="inline-flex items-center gap-0.5 text-muted-foreground">
          <span>{DISTRIBUTION_TYPE_MINI_LABEL[type]}</span>
          <DistributionPercentBadge value={aggregate.byType[type].percent} />
        </span>
      ))}
      <span className="inline-flex items-center gap-0.5 text-muted-foreground">
        <span>Ротация</span>
        <DistributionRotationBadge
          count={aggregate.totalLegacyOurs}
          percent={aggregate.rotationPotentialPercent}
          testId={testId ? `${testId}-rotation` : undefined}
        />
      </span>
    </div>
  );
}
