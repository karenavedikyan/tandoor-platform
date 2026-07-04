import { Badge } from "@/components/ui/badge";
import { ShowcaseCoverPhotoSlot } from "@/components/showcase-cover-photo-slot";
import {
  coverageBadgeClass,
  freshnessLabel,
} from "@/components/distribution/distribution-tradepoint-matrix-entry";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import type { DistributionEntryTradePointRow } from "@/lib/distribution-entry-tradepoint-view-model";
import type { DistributionEntryTradePointView } from "@/lib/distribution-entry-tradepoint-view";
import { formatDisplayDate } from "@/lib/format-datetime";
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

function isMeaningfulLocationPart(value: string | null | undefined): boolean {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 && trimmed !== "—" && trimmed !== "-";
}

function resolveCityLabel(point: DealerTradePoint, rowCity: string | null): string {
  if (isMeaningfulLocationPart(point.city)) return point.city.trim();
  if (isMeaningfulLocationPart(rowCity)) return rowCity!.trim();
  return "";
}

function formatCityAddressLine(point: DealerTradePoint, rowCity: string | null): string {
  const city = resolveCityLabel(point, rowCity);
  const address = isMeaningfulLocationPart(point.address) ? point.address.trim() : "";
  if (!city && !address) return "";
  if (!address) return city;
  if (!city) return address;
  return `${city}, ${address}`;
}

function formatCompactClientLine(row: DistributionEntryTradePointRow, point: DealerTradePoint): string {
  const city = resolveCityLabel(point, row.city);
  return city ? `${row.clientName} · ${city}` : row.clientName;
}

function CoverageBadge({ row }: { row: DistributionEntryTradePointRow }) {
  if (row.templateModelsCount === 0) {
    if (row.installedOursTotal > 0) {
      return (
        <Badge variant="outline" className="text-[10px] font-medium tabular-nums">
          На витрине: {row.installedOursTotal}
        </Badge>
      );
    }
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

function FilledDateHint({ row }: { row: DistributionEntryTradePointRow }) {
  const hasFilledData = row.filledCount > 0 || row.installedOursTotal > 0;
  if (!hasFilledData || !row.lastUpdatedAt) return null;
  return (
    <span className="whitespace-nowrap text-[10px] text-muted-foreground tabular-nums">
      · {formatDisplayDate(row.lastUpdatedAt)}
    </span>
  );
}

function CoverageWithDate({ row }: { row: DistributionEntryTradePointRow }) {
  return (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-x-1">
      <CoverageBadge row={row} />
      <FilledDateHint row={row} />
    </div>
  );
}

function CompactOnShelfBadge({ row }: { row: DistributionEntryTradePointRow }) {
  if (row.templateModelsCount === 0) {
    if (row.installedOursTotal > 0) {
      return (
        <Badge variant="outline" className="max-w-full text-[10px] font-medium tabular-nums">
          На витрине: {row.installedOursTotal}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[10px] font-medium">
        нет матрицы
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className={cn("max-w-full text-[10px] font-medium tabular-nums", coverageBadgeClass(row.coveragePct))}
    >
      {row.filledCount}/{row.templateModelsCount}
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
  const cityAddressLine = formatCityAddressLine(point, row.city);
  const compactClientLine = formatCompactClientLine(row, point);

  if (view === "compact") {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full min-w-0 flex-col gap-1.5 rounded-xl border p-2 text-left transition-colors sm:flex-row sm:items-start sm:gap-2.5 sm:p-2.5",
          selectedCls,
        )}
        data-testid={`distribution-entry-tradepoint-row-${row.tradePointId}`}
      >
        <div className="flex min-w-0 w-full gap-2">
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
            <p
              className="break-words text-sm font-semibold leading-snug text-foreground line-clamp-2"
              data-testid={`distribution-entry-tradepoint-name-${row.tradePointId}`}
            >
              {row.tradePointName}
            </p>
            <p
              className="break-words text-xs text-muted-foreground line-clamp-1"
              data-testid={`distribution-entry-tradepoint-client-${row.tradePointId}`}
            >
              {compactClientLine}
            </p>
          </div>
          <div className="hidden shrink-0 self-center sm:flex sm:max-w-[6.5rem] sm:justify-end">
            <CompactOnShelfBadge row={row} />
          </div>
        </div>
        <div className="flex items-center gap-1 pl-10 sm:hidden">
          <CompactOnShelfBadge row={row} />
        </div>
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
              <div className="min-w-0 space-y-1">
                <p
                  className="break-words text-base font-semibold leading-snug text-foreground sm:text-lg"
                  data-testid={`distribution-entry-tradepoint-name-${row.tradePointId}`}
                >
                  {row.tradePointName}
                </p>
                <p
                  className="break-words text-sm font-medium text-foreground"
                  data-testid={`distribution-entry-tradepoint-client-${row.tradePointId}`}
                >
                  {row.clientName}
                </p>
                {cityAddressLine ? (
                  <p
                    className="break-words text-xs text-muted-foreground"
                    data-testid={`distribution-entry-tradepoint-location-${row.tradePointId}`}
                  >
                    {cityAddressLine}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <CoverageWithDate row={row} />
                <span className="text-[10px] text-muted-foreground">{freshness}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
