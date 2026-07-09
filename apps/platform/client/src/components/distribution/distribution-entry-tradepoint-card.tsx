import { Badge } from "@/components/ui/badge";
import { ShowcaseCoverPhotoSlot } from "@/components/showcase-cover-photo-slot";
import {
  coverageBadgeClass,
  freshnessLabel,
} from "@/components/distribution/distribution-tradepoint-matrix-entry";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import type { DistributionEntryTradePointRow } from "@/lib/distribution-entry-tradepoint-view-model";
import type { DistributionEntryTradePointView } from "@/lib/distribution-entry-tradepoint-view";
import { getClientCategoryBadgeClass, getClientCategoryShortLabel } from "@/lib/client-category";
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

function formatDetailMetaLine(point: DealerTradePoint): string {
  const parts: string[] = [];
  if (isMeaningfulLocationPart(point.format)) parts.push(point.format!.trim());
  if (isMeaningfulLocationPart(point.contactPhone)) parts.push(point.contactPhone!.trim());
  return parts.join(" · ");
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
    <div className="flex max-w-full flex-col items-end gap-1">
      <div className="flex max-w-full flex-wrap items-center justify-end gap-x-1">
        <CoverageBadge row={row} />
        <FilledDateHint row={row} />
      </div>
      <SegmentDistributionLine row={row} />
    </div>
  );
}

function ResponsiblesLine({ row }: { row: DistributionEntryTradePointRow }) {
  const parts: string[] = [];
  if (row.managerName?.trim()) parts.push(`Менеджер: ${row.managerName.trim()}`);
  if (row.regionalManagerName?.trim()) parts.push(`Регионал: ${row.regionalManagerName.trim()}`);
  if (row.ropName?.trim()) parts.push(`РОП: ${row.ropName.trim()}`);
  if (row.furnitureManagerName?.trim()) parts.push(`Мебельщик: ${row.furnitureManagerName.trim()}`);
  if (parts.length === 0) return null;
  return (
    <p
      className="line-clamp-1 text-[11px] text-muted-foreground"
      data-testid={`distribution-entry-tradepoint-responsibles-${row.tradePointId}`}
    >
      {parts.join(" · ")}
    </p>
  );
}

function SegmentDistributionLine({ row }: { row: DistributionEntryTradePointRow }) {
  const { vh, mk, hardware } = row.installedOursBySegment;
  const rotation = row.installedOursRotation;
  const hasSegments = vh > 0 || mk > 0 || hardware > 0 || rotation > 0;
  if (!hasSegments) return null;
  const parts: string[] = [];
  if (vh > 0) parts.push(`ВХ: ${vh}`);
  if (mk > 0) parts.push(`МК: ${mk}`);
  if (hardware > 0) parts.push(`Фурн: ${hardware}`);
  if (rotation > 0) parts.push(`Ротация: ${rotation}`);
  return (
    <div
      className="flex max-w-full flex-wrap justify-end gap-x-1.5 text-[10px] text-muted-foreground tabular-nums"
      data-testid={`distribution-entry-tradepoint-segments-${row.tradePointId}`}
    >
      {parts.map((part) => (
        <Badge key={part} variant="outline" className="px-1.5 py-0 text-[10px] font-medium">
          {part}
        </Badge>
      ))}
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

function ClientCategoryPill({ row }: { row: DistributionEntryTradePointRow }) {
  const label = getClientCategoryShortLabel(row.clientCategory);
  if (!label || label === "—") return null;
  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 px-1.5 py-0 text-[10px] font-medium leading-none", getClientCategoryBadgeClass(row.clientCategory))}
    >
      {label}
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
  const selectedCls = selected
    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/30"
    : "border-border bg-card hover:bg-muted/40";
  const cityAddressLine = formatCityAddressLine(point, row.city);
  const compactClientLine = formatCompactClientLine(row, point);
  const detailMetaLine = formatDetailMetaLine(point);
  const compactDateHint =
    row.lastUpdatedAt && (row.filledCount > 0 || row.installedOursTotal > 0)
      ? formatDisplayDate(row.lastUpdatedAt)
      : null;

  if (view === "compact") {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex h-[60px] w-full min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors",
          selectedCls,
        )}
        data-testid={`distribution-entry-tradepoint-row-${row.tradePointId}`}
      >
        <ShowcaseCoverPhotoSlot
          kind="trade_point"
          dealer={dealer}
          tradePoint={point}
          profile={profile}
          size="table"
          rounded="md"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold text-foreground"
            data-testid={`distribution-entry-tradepoint-name-${row.tradePointId}`}
          >
            {row.tradePointName}
          </p>
          <p
            className="truncate text-xs text-muted-foreground"
            data-testid={`distribution-entry-tradepoint-client-${row.tradePointId}`}
          >
            {compactClientLine}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end justify-center gap-0.5">
          <CompactOnShelfBadge row={row} />
          {compactDateHint ? (
            <span className="whitespace-nowrap text-[10px] text-muted-foreground tabular-nums">{compactDateHint}</span>
          ) : null}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full min-w-0 shrink-0 overflow-hidden rounded-xl border text-left shadow-sm transition-colors",
        selectedCls,
      )}
      data-testid={`distribution-entry-tradepoint-row-${row.tradePointId}`}
    >
      <div className="flex w-full min-w-0 gap-3 p-3">
        <ShowcaseCoverPhotoSlot
          kind="trade_point"
          dealer={dealer}
          tradePoint={point}
          profile={profile}
          size="branch"
          rounded="md"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 items-start gap-2">
            <p
              className="min-w-0 flex-1 break-words text-base font-semibold leading-snug text-foreground line-clamp-2"
              data-testid={`distribution-entry-tradepoint-name-${row.tradePointId}`}
            >
              {row.tradePointName}
            </p>
            <ClientCategoryPill row={row} />
          </div>
          <p
            className="break-words text-sm font-medium text-foreground line-clamp-1"
            data-testid={`distribution-entry-tradepoint-client-${row.tradePointId}`}
          >
            {row.clientName}
          </p>
          {cityAddressLine ? (
            <p
              className="break-words text-xs text-muted-foreground line-clamp-2"
              data-testid={`distribution-entry-tradepoint-location-${row.tradePointId}`}
            >
              {cityAddressLine}
            </p>
          ) : null}
          <ResponsiblesLine row={row} />
          {detailMetaLine ? (
            <p className="truncate text-[11px] text-muted-foreground">{detailMetaLine}</p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-border/50 pt-1.5">
            <CoverageWithDate row={row} />
            <span className="text-[10px] text-muted-foreground tabular-nums">{freshness}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
