import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Grid3x3, LayoutGrid, List, Package, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import {
  type CatalogCardSize,
  catalogCardGridClass,
  readCatalogCardSizeFromStorage,
  writeCatalogCardSizeToStorage,
} from "@/lib/catalog-card-grid";
import type { ShowcasePlacementSegment } from "@/lib/showcase-matrix-api";
import {
  PLACEMENT_SEGMENT_LABEL_RU,
  PLACEMENT_TYPE_LABEL_RU,
} from "@/lib/showcase-placement-labels";
import { DistributionPercentBadge } from "@/lib/showcase-distribution-segment-badges";
import {
  loadCachedMatrix,
  SHOWCASE_MATRIX_STORE_CHANGED_EVENT,
} from "@/lib/showcase-matrix-store";
import {
  buildSegmentDetail,
  type SegmentDetail,
  type SegmentOurModelCard,
} from "@/lib/trade-point-showcase-segment-models";
import { cn } from "@/lib/utils";

type TradePointShowcaseSegmentSummaryProps = {
  tradePointId: string;
  density?: "comfortable" | "compact";
};

const SEGMENTS: ShowcasePlacementSegment[] = ["vh", "mk", "hardware"];

const SHOWCASE_SEGMENT_CARD_SIZE_KEY = "showcase-segment-summary:card-size";

const CARD_SIZE_OPTIONS = [
  { id: "xl" as const, label: "Крупный", icon: Square, hideNarrow: true },
  { id: "m" as const, label: "Средний", icon: LayoutGrid, hideNarrow: false },
  { id: "s" as const, label: "Мелкий", icon: Grid3x3, hideNarrow: true },
  { id: "list" as const, label: "Список", icon: List, hideNarrow: false },
] as const;

function SegmentHeaderMetrics({ detail, compact }: { detail: SegmentDetail; compact: boolean }) {
  if (detail.source === "models") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-muted-foreground",
          compact && "text-[11px]",
        )}
      >
        <span>наши модели: {detail.totalOurs}</span>
        <Badge variant="outline" className="text-[10px] font-normal">
          по статусам моделей
        </Badge>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-muted-foreground",
        compact && "gap-x-2 text-[11px]",
      )}
    >
      <span>всего блоков: {detail.blockCount}</span>
      <span>ёмкость: {detail.totalCapacity}</span>
      <span>наши: {detail.totalOurs}</span>
      <DistributionPercentBadge percent={detail.distributionPercent} />
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
              <th className="px-2 py-2 font-medium">Блоков</th>
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

function SegmentModelPhoto({
  model,
  cardSize,
  className,
}: {
  model: SegmentOurModelCard;
  cardSize: CatalogCardSize;
  className?: string;
}) {
  if (model.imageUrl) {
    return (
      <img
        src={model.imageUrl}
        alt=""
        className={className}
        loading="lazy"
      />
    );
  }

  return (
    <div className={cn("flex items-center justify-center rounded-lg bg-muted text-muted-foreground", className)}>
      <Package className={cardSize === "list" ? "h-5 w-5" : cardSize === "s" ? "h-6 w-6" : "h-8 w-8"} aria-hidden />
    </div>
  );
}

function SegmentModelListRow({
  model,
  segment,
}: {
  model: SegmentOurModelCard;
  segment: ShowcasePlacementSegment;
}) {
  return (
    <div
      className="flex min-w-0 items-center gap-3 rounded-lg border border-border/70 bg-card p-2 shadow-xs"
      data-testid={`segment-model-card-${segment}-${model.modelId}`}
    >
      <SegmentModelPhoto
        model={model}
        cardSize="list"
        className="aspect-[3/4] h-14 w-14 shrink-0 rounded-md object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{model.name}</p>
        {model.series ? (
          <p className="truncate text-xs text-muted-foreground">{model.series}</p>
        ) : null}
      </div>
      <Badge variant="secondary" className="shrink-0 tabular-nums">
        × {model.count}
      </Badge>
    </div>
  );
}

function SegmentModelGridCard({
  model,
  segment,
  cardSize,
}: {
  model: SegmentOurModelCard;
  segment: ShowcasePlacementSegment;
  cardSize: Exclude<CatalogCardSize, "list">;
}) {
  const photoClass =
    cardSize === "xl"
      ? "aspect-[3/4] w-full rounded-lg object-cover"
      : cardSize === "m"
        ? "aspect-[3/4] h-32 w-full rounded-lg object-cover"
        : "aspect-[3/4] h-20 w-full rounded-lg object-cover";

  const nameClass =
    cardSize === "xl"
      ? "truncate text-base font-semibold"
      : cardSize === "m"
        ? "truncate text-sm font-medium"
        : "truncate text-xs font-medium";

  const seriesClass =
    cardSize === "xl" ? "truncate text-sm text-muted-foreground" : "truncate text-xs text-muted-foreground";

  const badgeClass = cardSize === "xl" ? "mt-1.5 text-sm tabular-nums" : "mt-1.5 tabular-nums";

  return (
    <div
      className="min-w-0 rounded-lg border border-border/70 bg-card p-2 shadow-xs"
      data-testid={`segment-model-card-${segment}-${model.modelId}`}
    >
      <div className="mb-2">
        <SegmentModelPhoto model={model} cardSize={cardSize} className={photoClass} />
      </div>
      <p className={nameClass}>{model.name}</p>
      {model.series ? <p className={seriesClass}>{model.series}</p> : null}
      <Badge variant="secondary" className={badgeClass}>
        × {model.count}
      </Badge>
    </div>
  );
}

function SegmentOurModelsGrid({
  detail,
  compact,
  cardSize,
}: {
  detail: SegmentDetail;
  compact: boolean;
  cardSize: CatalogCardSize;
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
      ) : cardSize === "list" ? (
        <div className="flex flex-col gap-2">
          {detail.ourModels.map((model) => (
            <SegmentModelListRow key={model.modelId} model={model} segment={detail.segment} />
          ))}
        </div>
      ) : (
        <div className={cn(catalogCardGridClass(cardSize), compact && cardSize === "s" && "gap-1.5")}>
          {detail.ourModels.map((model) => (
            <SegmentModelGridCard
              key={model.modelId}
              model={model}
              segment={detail.segment}
              cardSize={cardSize}
            />
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
  cardSize,
}: {
  detail: SegmentDetail;
  compact: boolean;
  cardSize: CatalogCardSize;
}) {
  if (detail.source === "models") {
    return (
      <div className={cn("space-y-3 border-t border-border/60 pt-3", compact && "space-y-2 pt-2")}>
        <p className="text-sm text-muted-foreground">
          Витрины как блоки в этом сегменте не заведены. Показаны модели, отмеченные на витрине ТТ по
          статусу.
        </p>
        <SegmentOurModelsGrid detail={detail} compact={compact} cardSize={cardSize} />
      </div>
    );
  }

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
      <SegmentOurModelsGrid detail={detail} compact={compact} cardSize={cardSize} />
      <SegmentCompetitorsList detail={detail} />
    </div>
  );
}

function SegmentRow({
  detail,
  compact,
  cardSize,
}: {
  detail: SegmentDetail;
  compact: boolean;
  cardSize: CatalogCardSize;
}) {
  const label = PLACEMENT_SEGMENT_LABEL_RU[detail.segment];
  const isEmpty = detail.source === "empty";

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
            <SegmentExpandedContent detail={detail} compact={compact} cardSize={cardSize} />
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
  const [cardSize, setCardSize] = useState<CatalogCardSize>(() =>
    readCatalogCardSizeFromStorage(SHOWCASE_SEGMENT_CARD_SIZE_KEY, "m"),
  );

  const bumpCache = useCallback(() => setCacheBump((n) => n + 1), []);

  useEffect(() => {
    writeCatalogCardSizeToStorage(SHOWCASE_SEGMENT_CARD_SIZE_KEY, cardSize);
  }, [cardSize]);

  useEffect(() => {
    const onChange = () => bumpCache();
    window.addEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(SHOWCASE_MATRIX_STORE_CHANGED_EVENT, onChange);
  }, [bumpCache]);

  const placements = useMemo(() => {
    void cacheBump;
    return loadCachedMatrix(tradePointId);
  }, [tradePointId, cacheBump]);

  const segmentDetails = useMemo(
    () => SEGMENTS.map((segment) => buildSegmentDetail(placements, segment)),
    [placements],
  );

  const iconBtnSize = compact ? "h-8 w-8" : "h-9 w-9";

  return (
    <Card
      className="rounded-xl border border-border bg-card shadow-xs"
      data-testid="trade-point-showcase-segment-summary"
    >
      <CardContent className={cn("space-y-2 px-3 py-3 sm:px-4", compact && "space-y-1.5 px-2.5 py-2.5")}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Витрина в ТТ
          </h3>
          <div
            className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-card p-0.5"
            role="radiogroup"
            aria-label="Размер карточек моделей сегмента"
            data-testid="showcase-segment-card-size-toggle"
          >
            {CARD_SIZE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = cardSize === opt.id;
              return (
                <Button
                  key={opt.id}
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn(
                    iconBtnSize,
                    "shrink-0 rounded-md border",
                    opt.hideNarrow && "max-[865px]:hidden",
                    active
                      ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-transparent bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  aria-label={opt.label}
                  aria-pressed={active}
                  onClick={() => setCardSize(opt.id)}
                  data-testid={`showcase-segment-card-size-${opt.id}`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </Button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          {segmentDetails.map((detail) => (
            <SegmentRow key={detail.segment} detail={detail} compact={compact} cardSize={cardSize} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
