import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import type { ShowcasePlacementSegment } from "@/lib/showcase-matrix-api";
import {
  PLACEMENT_SEGMENT_LABEL_RU,
  PLACEMENT_TYPE_LABEL_RU,
} from "@/lib/showcase-placement-labels";
import {
  loadCachedPlacements,
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT,
} from "@/lib/showcase-matrix-store";
import { buildSegmentDetail, type SegmentDetail } from "@/lib/trade-point-showcase-segment-models";
import { cn } from "@/lib/utils";

type TradePointShowcaseSegmentSummaryProps = {
  tradePointId: string;
  density?: "comfortable" | "compact";
};

const SEGMENTS: ShowcasePlacementSegment[] = ["vh", "mk", "hardware"];

function percentBadgeVariant(percent: number): "destructive" | "secondary" | "default" {
  if (percent < 30) return "destructive";
  if (percent < 70) return "secondary";
  return "default";
}

function percentBadgeClass(percent: number): string {
  if (percent >= 70) {
    return "border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
  }
  if (percent >= 30) {
    return "border-amber-500/30 bg-amber-500/15 text-amber-900 dark:text-amber-200";
  }
  return "";
}

function SegmentHeaderMetrics({ detail, compact }: { detail: SegmentDetail; compact: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground",
        compact && "gap-x-2 text-[11px]",
      )}
    >
      <span>всего витрин: {detail.blockCount}</span>
      <span>ёмкость: {detail.totalCapacity}</span>
      <span>наши: {detail.totalOurs}</span>
      <Badge
        variant={percentBadgeVariant(detail.distributionPercent)}
        className={cn("font-semibold tabular-nums", percentBadgeClass(detail.distributionPercent))}
      >
        {detail.distributionPercent}%
      </Badge>
    </div>
  );
}

function SegmentTypeBreakdownTable({
  detail,
  compact,
}: {
  detail: SegmentDetail;
  compact: boolean;
}) {
  if (detail.byPlacementType.length === 0) return null;

  return (
    <div className="space-y-2" data-testid={`segment-type-breakdown-${detail.segment}`}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Разбивка по типу размещения
      </h4>
      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className={cn("w-full min-w-[520px] text-left text-xs", compact && "text-[11px]")}>
          <thead>
            <tr className="border-b border-border/70 bg-muted/30">
              <th className="px-2 py-2 font-medium">Тип</th>
              <th className="px-2 py-2 font-medium">Витр.</th>
              <th className="px-2 py-2 font-medium">Ёмкость</th>
              <th className="px-2 py-2 font-medium">Наши</th>
              <th className="px-2 py-2 font-medium">Конкур.</th>
              <th className="px-2 py-2 font-medium">Свободно</th>
            </tr>
          </thead>
          <tbody>
            {detail.byPlacementType.map((row) => (
              <tr key={row.placementType} className="border-b border-border/50 last:border-0">
                <td className="px-2 py-2">{PLACEMENT_TYPE_LABEL_RU[row.placementType]}</td>
                <td className="px-2 py-2 tabular-nums">{row.blockCount}</td>
                <td className="px-2 py-2 tabular-nums">{row.capacity}</td>
                <td className="px-2 py-2 tabular-nums">{row.ours}</td>
                <td className="px-2 py-2 tabular-nums">{row.competitors}</td>
                <td className="px-2 py-2 tabular-nums">{row.free}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SegmentOurModelsGrid({
  detail,
  compact,
}: {
  detail: SegmentDetail;
  compact: boolean;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Наши модели в этом сегменте
      </h4>
      {detail.ourModels.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          В витринах этого сегмента наших моделей пока нет
        </p>
      ) : (
        <div
          className={cn(
            "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
            compact && "gap-2 sm:grid-cols-2",
          )}
        >
          {detail.ourModels.map((model) => (
            <div
              key={model.modelId}
              className="min-w-0 rounded-lg border border-border/70 bg-card p-2 shadow-xs"
              data-testid={`segment-model-card-${detail.segment}-${model.modelId}`}
            >
              <div className="mb-2 flex justify-center">
                {model.imageUrl ? (
                  <img
                    src={model.imageUrl}
                    alt=""
                    className="h-24 w-24 rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Package className="h-8 w-8" aria-hidden />
                  </div>
                )}
              </div>
              <p className="truncate text-sm font-medium">{model.name}</p>
              {model.series ? (
                <p className="truncate text-xs text-muted-foreground">{model.series}</p>
              ) : null}
              <Badge variant="secondary" className="mt-1.5 tabular-nums">
                × {model.count}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SegmentCompetitorsList({ detail }: { detail: SegmentDetail }) {
  if (detail.competitorRows.length === 0) return null;

  return (
    <div className="space-y-2" data-testid={`segment-competitors-${detail.segment}`}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Конкуренты в этом сегменте
      </h4>
      <ul className="space-y-1 text-sm text-foreground">
        {detail.competitorRows.map((row) => (
          <li key={row.brand}>
            {row.brand} × {row.count}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SegmentExpandedContent({
  detail,
  compact,
}: {
  detail: SegmentDetail;
  compact: boolean;
}) {
  return (
    <div className={cn("space-y-4 border-t border-border/60 pt-3", compact && "space-y-3 pt-2")}>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          % дистрибуции = наши ÷ общая ёмкость = {detail.totalOurs} ÷ {detail.totalCapacity} ={" "}
          {detail.distributionPercent}%
        </p>
        <Progress value={detail.distributionPercent} className="h-2" />
      </div>

      <SegmentTypeBreakdownTable detail={detail} compact={compact} />
      <SegmentOurModelsGrid detail={detail} compact={compact} />
      <SegmentCompetitorsList detail={detail} />
    </div>
  );
}

function SegmentRow({
  detail,
  compact,
}: {
  detail: SegmentDetail;
  compact: boolean;
}) {
  const label = PLACEMENT_SEGMENT_LABEL_RU[detail.segment];
  const isEmpty = detail.blockCount === 0 && detail.ourModels.length === 0;

  if (isEmpty) {
    return (
      <div
        className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-2 text-sm text-muted-foreground"
        data-testid={`segment-row-${detail.segment}`}
      >
        {label} — нет данных
      </div>
    );
  }

  return (
    <Collapsible className="group">
      <div
        className="rounded-lg border border-border/70 bg-card shadow-xs"
        data-testid={`segment-row-${detail.segment}`}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full flex-col gap-2 px-3 py-2.5 text-left sm:flex-row sm:items-center sm:justify-between",
              compact && "px-2.5 py-2",
            )}
          >
            <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
              <ChevronDown className="h-4 w-4 shrink-0 opacity-70 transition-transform group-data-[state=open]:rotate-180" />
              {label}
            </span>
            <SegmentHeaderMetrics detail={detail} compact={compact} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className={cn("px-3 pb-3", compact && "px-2.5 pb-2.5")}>
            <SegmentExpandedContent detail={detail} compact={compact} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function TradePointShowcaseSegmentSummary({
  tradePointId,
  density = "comfortable",
}: TradePointShowcaseSegmentSummaryProps) {
  const compact = density === "compact";
  const [cacheBump, setCacheBump] = useState(0);

  const bumpCache = useCallback(() => setCacheBump((n) => n + 1), []);

  useEffect(() => {
    const onChange = () => bumpCache();
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onChange);
  }, [bumpCache]);

  const placements = useMemo(() => {
    void cacheBump;
    return loadCachedPlacements(tradePointId);
  }, [tradePointId, cacheBump]);

  const segmentDetails = useMemo(
    () => SEGMENTS.map((segment) => buildSegmentDetail(placements, segment)),
    [placements],
  );

  return (
    <Card
      className="rounded-xl border border-border bg-card shadow-xs"
      data-testid="trade-point-showcase-segment-summary"
    >
      <CardContent className={cn("space-y-2 px-3 py-3 sm:px-4", compact && "space-y-1.5 px-2.5 py-2.5")}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Витрина в ТТ
        </h3>
        <div className="space-y-2">
          {segmentDetails.map((detail) => (
            <SegmentRow key={detail.segment} detail={detail} compact={compact} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
