import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { ShowcaseCoverPhotoSlot } from "@/components/showcase-cover-photo-slot";
import {
  coverageBadgeClass,
  freshnessLabel,
} from "@/components/distribution/distribution-tradepoint-matrix-entry";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import type { DistributionEntryTradePointRow } from "@/lib/distribution-entry-tradepoint-view-model";
import type { DistributionEntryTradePointView } from "@/lib/distribution-entry-tradepoint-view";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import { cn } from "@/lib/utils";

type DistributionEntryTradePointCardProps = {
  row: DistributionEntryTradePointRow;
  dealer: DealerRow;
  point: DealerTradePoint;
  profile: ReleaseDemoProfile;
  view: DistributionEntryTradePointView;
  selected?: boolean;
  onSelect: () => void;
};

function CoverageBadge({ row }: { row: DistributionEntryTradePointRow }) {
  const noMatrix = row.templateModelsCount === 0;
  if (noMatrix) {
    return (
      <Badge variant="outline" className="text-[10px] font-medium">
        нет матрицы
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium tabular-nums", coverageBadgeClass(row.coveragePct))}
    >
      {row.filledCount}/{row.templateModelsCount} · {row.coveragePct}%
    </Badge>
  );
}

export function DistributionEntryTradePointCard({
  row,
  dealer,
  point,
  profile,
  view,
  selected,
  onSelect,
}: DistributionEntryTradePointCardProps) {
  const freshness = freshnessLabel(row.lastUpdatedAt);
  const selectedCls = selected ? "border-primary/50 bg-primary/5 shadow-xs ring-1 ring-primary/20" : "border-border bg-card hover:bg-muted/40";

  if (view === "list") {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full min-w-0 gap-2 rounded-xl border p-2.5 text-left transition-colors sm:gap-3 sm:p-3",
          selectedCls,
        )}
        data-testid={`distribution-entry-tradepoint-row-${row.tradePointId}`}
      >
        <ShowcaseCoverPhotoSlot
          kind="trade_point"
          dealer={dealer}
          tradePoint={point}
          profile={profile}
          size="list"
          rounded="md"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-sm font-semibold text-foreground">{row.tradePointName}</p>
          <p className="truncate text-xs text-muted-foreground">{row.clientName}</p>
          {row.city ? <p className="truncate text-xs text-muted-foreground">{row.city}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 self-center">
          <CoverageBadge row={row} />
          <span className="text-[10px] text-muted-foreground">{freshness}</span>
        </div>
      </button>
    );
  }

  if (view === "grid") {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex min-h-0 w-full flex-col overflow-hidden rounded-xl border text-left shadow-sm transition-colors",
          selectedCls,
        )}
        data-testid={`distribution-entry-tradepoint-row-${row.tradePointId}`}
      >
        <ShowcaseCoverPhotoSlot
          kind="trade_point"
          dealer={dealer}
          tradePoint={point}
          profile={profile}
          size="grid"
          rounded="lg"
          className="w-full"
        />
        <CardContent className="flex min-h-0 flex-1 flex-col gap-1.5 p-2 sm:p-2.5">
          <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">{row.tradePointName}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground">{row.clientName}</p>
          {row.city ? <p className="line-clamp-1 text-xs text-muted-foreground">{row.city}</p> : null}
          <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
            <CoverageBadge row={row} />
            <span className="text-[10px] text-muted-foreground">{freshness}</span>
          </div>
        </CardContent>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full shrink-0 flex-col overflow-hidden rounded-xl border text-left shadow-sm transition-colors",
        selectedCls,
      )}
      data-testid={`distribution-entry-tradepoint-row-${row.tradePointId}`}
    >
      <div className="w-full space-y-3 p-3 sm:p-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:gap-4">
          <ShowcaseCoverPhotoSlot
            kind="trade_point"
            dealer={dealer}
            tradePoint={point}
            profile={profile}
            size="large"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <p className="text-lg font-semibold leading-snug text-foreground sm:text-xl">{row.tradePointName}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{row.clientName}</span>
                  {row.city ? <span className="mt-0.5 block text-xs">{row.city}</span> : null}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <CoverageBadge row={row} />
                <span className="text-[10px] text-muted-foreground">{freshness}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
