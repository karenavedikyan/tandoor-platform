import { useMemo, useState } from "react";
import { Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DistributionFullscreenEntry } from "@/components/distribution/distribution-fullscreen-entry";
import { TradePointShowcaseParamsSection } from "@/components/trade-point-showcase-params-section";
import { Card, CardContent } from "@/components/ui/card";
import {
  TradePointShowcaseMatrixSection,
  type TradePointShowcasePageBundle,
} from "@/components/trade-point-showcase-matrix-section";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { formatRelativeTime } from "@/lib/format-datetime";
import type { TradePointMatrixSummary } from "@/lib/trade-point-matrix-data";
import { getShowcaseMatrixModelsForTradePoint } from "@/lib/trade-point-showcase-matrix-models";
import { canEditTradePointShowcaseMatrix } from "@/lib/trade-point-showcase-matrix-storage";



export function freshnessLabel(lastUpdatedAt: string | null): string {
  if (!lastUpdatedAt) return "нет данных";
  return `обновлено ${formatRelativeTime(lastUpdatedAt)}`;
}

export function coverageBadgeClass(pct: number): string {
  if (pct >= 100) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  if (pct >= 50) return "border-primary/30 bg-primary/10 text-primary";
  return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200";
}

const EMPTY_MATRIX_SUMMARY: TradePointMatrixSummary = {
  totalRequired: 0,
  totalPresent: 0,
  totalMissing: 0,
  totalUnderReview: 0,
  zoneA: 0,
  zoneB: 0,
  zoneC: 0,
  entrancePresent: 0,
  entranceRequired: 0,
  interiorPresent: 0,
  interiorRequired: 0,
};

export function buildDistributionEntryShowcasePageBundle(
  point: { id: string; distribution: { mk: number; vh: number; total: number } },
): TradePointShowcasePageBundle {
  const noop = () => undefined;
  return {
    matrixSummary: EMPTY_MATRIX_SUMMARY,
    showcaseComment: "—",
    distribution: point.distribution,
    distributionConclusion: "—",
    productMatrixFiltered: [],
    productMatrixFilter: "all",
    onProductMatrixFilterChange: noop,
    recommendationByProductId: new Map(),
    showcaseTasksOpen: [],
    openTasksCount: 0,
    recommendations: [],
    createdTaskByProductId: new Map(),
    onCreateMatrixTask: noop,
    onScrollToMatrixTask: noop,
    tasksLinkHref: `/trade-points/${point.id}`,
    matrixTasksSlot: null,
  };
}

type DistributionTradePointMatrixEntryProps = {
  dealer: DealerRow;
  point: DealerTradePoint;
  profile: ReleaseDemoProfile;
  actorUserId: string;
  actorName: string;
};

export function DistributionTradePointMatrixEntry({
  dealer,
  point,
  profile,
  actorUserId,
  actorName,
}: DistributionTradePointMatrixEntryProps) {
  const templateModelsCount = useMemo(
    () =>
      getShowcaseMatrixModelsForTradePoint(dealer.id, point.id, dealer.clientCategory).length,
    [dealer.id, point.id, dealer.clientCategory],
  );

  const showcasePage = useMemo(
    () => buildDistributionEntryShowcasePageBundle(point),
    [point],
  );

  const canEdit = useMemo(
    () => canEditTradePointShowcaseMatrix(profile, dealer),
    [profile, dealer],
  );
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  return (
    <div className="space-y-3">
      <TradePointShowcaseParamsSection dealer={dealer} point={point} profile={profile} canEdit={canEdit} />
      {templateModelsCount === 0 ? (
        <Card className="rounded-xl border border-border bg-card shadow-xs">
          <CardContent className="px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">Активная матрица не назначена</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Для этой торговой точки нет чек-листа моделей. Выберите другую точку или назначьте матрицу в
              справочнике.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {canEdit ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 gap-2"
                data-testid="button-distribution-entry-fullscreen"
                onClick={() => setFullscreenOpen(true)}
              >
                <Maximize2 className="h-4 w-4 shrink-0" aria-hidden />
                Полноэкранный режим
              </Button>
            </div>
          ) : null}
          <TradePointShowcaseMatrixSection
            dealer={dealer}
            point={point}
            profile={profile}
            actorUserId={actorUserId}
            actorName={actorName}
            page={showcasePage}
            density="compact"
          />
          {fullscreenOpen && canEdit ? (
            <DistributionFullscreenEntry
              dealer={dealer}
              point={point}
              profile={profile}
              actorUserId={actorUserId}
              actorName={actorName}
              onClose={() => setFullscreenOpen(false)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
