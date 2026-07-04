import type { ReactElement } from "react";
import type { ActualizationState } from "@/lib/client-base-actualization-state";
import { ManagerDistributionMiniBar } from "@/components/distribution/manager-distribution-mini-bar";

type Props = {
  externalKeys: string[];
  act: ActualizationState;
  testId: string;
};

export function DistributionCardHeaderBlock({
  externalKeys,
  act,
  testId,
}: Props): ReactElement | null {
  if (externalKeys.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2"
      data-testid={`${testId}-wrap`}
    >
      <span className="shrink-0 text-xs text-muted-foreground">Дистрибуция</span>
      <ManagerDistributionMiniBar
        externalKeys={externalKeys}
        act={act}
        prefetching={false}
        testId={testId}
      />
    </div>
  );
}
