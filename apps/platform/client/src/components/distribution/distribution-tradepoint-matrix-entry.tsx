import { useMemo } from "react";
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

  if (templateModelsCount === 0) {
    return (
      <Card className="rounded-xl border border-border bg-card shadow-xs">
        <CardContent className="px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Активная матрица не назначена</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Для этой торговой точки нет чек-листа моделей. Выберите другую точку или назначьте матрицу в
            справочнике.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TradePointShowcaseMatrixSection
      dealer={dealer}
      point={point}
      profile={profile}
      actorUserId={actorUserId}
      actorName={actorName}
      page={showcasePage}
    />
  );
}
