"use client";

import type { ReactElement } from "react";
import { ClientAvatar } from "@/components/ui/client-avatar";
import { SafeImage } from "@/components/safe-image";
import { cn } from "@/lib/utils";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";

export type ShowcaseCoverPhotoSlotSize = "hero" | "large" | "grid" | "list" | "branch" | "table";

/** Внешний контейнер с явными размерами; контент — absolute inset-0 внутри. */
const frameClass: Record<ShowcaseCoverPhotoSlotSize, string> = {
  hero:
    "relative aspect-video w-full max-w-full shrink-0 sm:aspect-[4/3] sm:max-h-[13rem] sm:w-[min(100%,15rem)] sm:max-w-[15rem]",
  large:
    "relative aspect-video w-full shrink-0 sm:aspect-[4/3] sm:max-h-[12rem] sm:w-[min(100%,14rem)] sm:max-w-[14rem]",
  grid: "relative aspect-[4/3] w-full shrink-0",
  list: "relative h-[4.5rem] w-[4.5rem] min-h-[4.5rem] min-w-[4.5rem] shrink-0",
  branch: "relative h-16 w-16 min-h-16 min-w-16 shrink-0",
  table: "relative h-10 w-10 min-h-10 min-w-10 shrink-0",
};

const avatarSizeBySlot: Record<ShowcaseCoverPhotoSlotSize, number> = {
  hero: 160,
  large: 144,
  grid: 112,
  list: 56,
  branch: 48,
  table: 32,
};

function avatarShapeForSize(size: ShowcaseCoverPhotoSlotSize): "circle" | "square" {
  return size === "hero" || size === "large" || size === "grid" ? "square" : "circle";
}

function avatarRoundClassForShape(shape: "circle" | "square"): string | undefined {
  return shape === "square" ? "rounded-2xl" : undefined;
}

export type ShowcaseCoverPhotoSlotProps = {
  kind: "dealer" | "trade_point";
  dealer: DealerRow;
  tradePoint?: DealerTradePoint;
  profile: ReleaseDemoProfile;
  size: ShowcaseCoverPhotoSlotSize;
  className?: string;
  /** Скругление превью */
  rounded?: "md" | "lg" | "xl";
  readOnly?: boolean;
};

function dealerDisplaySrc(row: DealerRow): string {
  const cover = row.coverPhotoThumbnailUrl?.trim() || row.coverPhotoUrl?.trim();
  if (cover) return cover;
  const logo = (row as DealerRow & { logoUrl?: string }).logoUrl?.trim();
  return logo ?? "";
}

function tradePointDisplaySrc(tp: DealerTradePoint): string {
  return tp.coverPhotoThumbnailUrl?.trim() || tp.coverPhotoUrl?.trim() || "";
}

export function ShowcaseCoverPhotoSlot(props: ShowcaseCoverPhotoSlotProps): ReactElement {
  const { kind, dealer, tradePoint, profile, size, className, rounded = "lg", readOnly = false } = props;
  void profile;
  void readOnly;

  const tp = kind === "trade_point" ? tradePoint : undefined;
  if (kind === "trade_point" && !tp) {
    return (
      <div
        className={cn("relative shrink-0 overflow-hidden rounded-lg border border-border bg-muted", frameClass[size], className)}
        aria-hidden
      />
    );
  }

  const displaySrc = kind === "dealer" ? dealerDisplaySrc(dealer) : tradePointDisplaySrc(tp!);
  const hasImage = Boolean(displaySrc);

  const imageTestId =
    kind === "dealer" ? `image-dealer-cover-photo-${dealer.id}` : `image-trade-point-cover-photo-${tp!.id}`;
  const placeholderTestId =
    kind === "dealer"
      ? `placeholder-dealer-cover-photo-${dealer.id}`
      : `placeholder-trade-point-cover-photo-${tp!.id}`;

  const roundCn = rounded === "xl" ? "rounded-xl" : rounded === "lg" ? "rounded-lg" : "rounded-md";
  const avatarShape = avatarShapeForSize(size);
  const avatarRoundClass = avatarRoundClassForShape(avatarShape);

  const placeholderName = kind === "dealer" ? dealer.name : tp!.name;
  const placeholderSeed =
    kind === "dealer"
      ? dealer.id || dealer.actualizationInn || dealer.name
      : tp!.id || tp!.releaseCode || tp!.name;

  return (
    <div
      className={cn(frameClass[size], className)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className={cn("absolute inset-0 overflow-hidden border border-border bg-card", roundCn)}>
        {hasImage ? (
          <div className="absolute inset-0" data-testid={imageTestId}>
            <SafeImage src={displaySrc} alt="" className="absolute inset-0 h-full w-full" objectFit="cover" />
          </div>
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center bg-card p-1"
            data-testid={placeholderTestId}
          >
            <ClientAvatar
              name={placeholderName}
              seed={placeholderSeed}
              size={avatarSizeBySlot[size]}
              shape={avatarShape}
              className={avatarRoundClass}
            />
          </div>
        )}
      </div>
    </div>
  );
}
