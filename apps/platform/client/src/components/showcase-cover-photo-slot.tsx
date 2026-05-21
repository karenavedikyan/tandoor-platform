"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import { Camera, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SafeImage } from "@/components/safe-image";
import { EntityActualizationPhotoGallery } from "@/components/entity-actualization-photo-gallery";
import { cn } from "@/lib/utils";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { DealerRow, DealerTradePoint } from "@/lib/dealer-base-mock-data";
import {
  canEditDealerDuringActualization,
  canEditTradePointDuringActualization,
} from "@/lib/client-base-actualization-permissions";
import { useClientBaseActualization } from "@/context/client-base-actualization-context";

export type ShowcaseCoverPhotoSlotSize = "hero" | "large" | "grid" | "list" | "branch";

const frameClass: Record<ShowcaseCoverPhotoSlotSize, string> = {
  hero: "h-28 w-28 min-h-28 min-w-28 sm:h-32 sm:w-32 sm:min-h-32 sm:min-w-32",
  large: "h-[5.25rem] w-[5.25rem] min-h-[5.25rem] min-w-[5.25rem] sm:h-24 sm:w-24 sm:min-h-24 sm:min-w-24",
  grid: "h-14 w-14 min-h-14 min-w-14 sm:h-16 sm:w-16 sm:min-h-16 sm:min-w-16",
  list: "h-12 w-12 min-h-12 min-w-12",
  branch: "h-10 w-10 min-h-10 min-w-10 sm:h-11 sm:w-11 sm:min-h-11 sm:min-w-11",
};

export type ShowcaseCoverPhotoSlotProps = {
  kind: "dealer" | "trade_point";
  dealer: DealerRow;
  tradePoint?: DealerTradePoint;
  profile: ReleaseDemoProfile;
  size: ShowcaseCoverPhotoSlotSize;
  className?: string;
  /** Скругление превью */
  rounded?: "md" | "lg" | "xl";
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
  const { kind, dealer, tradePoint, profile, size, className, rounded = "lg" } = props;
  const actx = useClientBaseActualization();
  const [open, setOpen] = useState(false);

  const tp = kind === "trade_point" ? tradePoint : undefined;
  if (kind === "trade_point" && !tp) {
    return <div className={cn("rounded-lg border border-border bg-muted", frameClass[size], className)} aria-hidden />;
  }

  const displaySrc = kind === "dealer" ? dealerDisplaySrc(dealer) : tradePointDisplaySrc(tp!);
  const hasImage = Boolean(displaySrc);

  const baseCanEdit =
    kind === "dealer"
      ? canEditDealerDuringActualization(profile, dealer)
      : canEditTradePointDuringActualization(profile, dealer, tp!);
  const canEditGallery = baseCanEdit && actx.enabled;

  const entityId = kind === "dealer" ? dealer.id : tp!.id;
  const dialogTitle = kind === "dealer" ? "Фото клиента" : "Фото торговой точки";

  const imageTestId =
    kind === "dealer" ? `image-dealer-cover-photo-${dealer.id}` : `image-trade-point-cover-photo-${tp!.id}`;
  const placeholderTestId =
    kind === "dealer"
      ? `placeholder-dealer-cover-photo-${dealer.id}`
      : `placeholder-trade-point-cover-photo-${tp!.id}`;
  const editTestId =
    kind === "dealer"
      ? `button-dealer-cover-photo-edit-${dealer.id}`
      : `button-trade-point-cover-photo-edit-${tp!.id}`;
  const addTestId =
    kind === "dealer" ? `button-dealer-cover-photo-add-${dealer.id}` : `button-trade-point-cover-photo-add-${tp!.id}`;

  const roundCn = rounded === "xl" ? "rounded-xl" : rounded === "lg" ? "rounded-lg" : "rounded-md";

  const openGallery = () => {
    if (!canEditGallery) return;
    setOpen(true);
  };

  const showCompactHint = size === "grid" || size === "list" || size === "branch";

  return (
    <>
      <div
        className={cn("relative shrink-0", frameClass[size], className)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className={cn("relative h-full w-full overflow-hidden border border-border bg-card", roundCn)}>
          {hasImage ? (
            <div className="absolute inset-0 h-full w-full" data-testid={imageTestId}>
              <SafeImage src={displaySrc} alt="" className="absolute inset-0 h-full w-full" objectFit="cover" />
            </div>
          ) : (
            <div
              className={cn(
                "flex h-full min-h-9 w-full flex-col items-center justify-center gap-0.5 bg-muted/40 p-1 text-muted-foreground",
                !canEditGallery && "opacity-90",
              )}
              data-testid={placeholderTestId}
            >
              <Camera className={cn("shrink-0 text-primary", showCompactHint ? "h-4 w-4" : "h-5 w-5")} aria-hidden />
              {!showCompactHint ? (
                <span className="px-0.5 text-center text-[10px] font-medium leading-tight">Добавить фото</span>
              ) : null}
            </div>
          )}

          {canEditGallery && !hasImage ? (
            <button
              type="button"
              className="absolute inset-0 z-[1] min-h-9 min-w-9 cursor-pointer rounded-inherit outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Добавить фото"
              data-testid={addTestId}
              onClick={(e) => {
                e.stopPropagation();
                openGallery();
              }}
            />
          ) : null}

          {canEditGallery && hasImage ? (
            <button
              type="button"
              className="absolute inset-0 z-[1] min-h-9 min-w-9 cursor-pointer rounded-inherit outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Открыть галерею фото"
              onClick={(e) => {
                e.stopPropagation();
                openGallery();
              }}
            />
          ) : null}

          {canEditGallery && hasImage ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute right-0.5 top-0.5 z-[2] h-9 w-9 min-h-9 min-w-9 border border-border bg-card/95 p-0 text-foreground shadow-sm hover:bg-primary/15"
              data-testid={editTestId}
              aria-label="Редактировать фото"
              onClick={(e) => {
                e.stopPropagation();
                openGallery();
              }}
            >
              <Pencil className="h-4 w-4 text-primary" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(92dvh,40rem)] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <EntityActualizationPhotoGallery
            entityType={kind === "dealer" ? "dealer" : "trade_point"}
            entityId={entityId}
            canEdit={canEditGallery}
            profile={profile}
            compact
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
