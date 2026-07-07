import { useEffect, useState, type ReactElement } from "react";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { fetchOneCLegal } from "@/lib/one-c-showroom-api";
import { DistributionCardHeaderBlock } from "@/components/distribution/distribution-card-header-block";
import { CompactDistributionBadge } from "@/components/distribution/compact-distribution-badge";
import { BrandDistributionLoader } from "@/components/distribution/brand-distribution-loader";

type Props = {
  legalId: string;
  act: ActualizationState;
  testId: string;
  variant?: "compact" | "full";
};

export function OneCLegalDistributionSummary({
  legalId,
  act,
  testId,
  variant = "compact",
}: Props): ReactElement | null {
  const [storeIds, setStoreIds] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStoreIds(null);
    void fetchOneCLegal(legalId)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setStoreIds([]);
          return;
        }
        setStoreIds(res.stores.map((s) => s.id_1c));
      })
      .catch(() => {
        if (!cancelled) setStoreIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [legalId]);

  if (storeIds === null) {
    return (
      <span data-testid={`${testId}-loading`}>
        <BrandDistributionLoader size="sm" />
      </span>
    );
  }

  if (storeIds.length === 0) return null;

  if (variant === "full") {
    return <DistributionCardHeaderBlock externalKeys={storeIds} act={act} testId={testId} />;
  }

  return <CompactDistributionBadge externalKeys={storeIds} act={act} testId={testId} />;
}
