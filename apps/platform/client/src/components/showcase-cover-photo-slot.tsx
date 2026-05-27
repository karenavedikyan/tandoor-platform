"use client";

import type { ReactElement } from "react";
import { useState } from "react";
import { Camera, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientAvatar } from "@/components/ui/client-avatar";
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
  const actx = useClientBaseActualization();
  const [open, setOpen] = useState(false);

  const tp = kind === "trade_point" ? tradePoint : undefined;
  if (kind === "trade_point" && !tp) {
    return (
      <div className={cn("relative shrink-0 overflow-hidden rounded-lg border border-border bg-muted", frameClass[size], className)} aria-hidden />
    );
  }

  const displaySrc = kind === "dealer" ? dealerDisplaySrc(dealer) : tradePointDisplaySrc(tp!);
  const hasImage = Boolean(displaySrc);

  const baseCanEdit =
    kind === "dealer"
      ? canEditDealerDuringActualization(profile, dealer)
      : canEditTradePointDuringActualization(profile, dealer, tp!);
  const canEditGallery = baseCanEdit && actx.enabled && !readOnly;

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

  const isTinyThumb = size === "branch" || size === "table";
  const showTwoLinePlaceholder = size === "hero" || size === "large" || size === "grid" || size === "list";

  const placeholderTitle =
    kind === "dealer" ? "Добавьте фото или логотип" : "Добавьте фото точки";
  const placeholderSubtitle =
    kind === "dealer" ? "Сделайте клиента узнаваемым" : "Покажите фасад или витрину";

  // Размеры фолбэк-аватара клиента по слоту. Аватар центрируется в frame; frame
  // остаётся с фоном `bg-card`, что хорошо выглядит и в темной теме.
  const dealerAvatarSizeBySlot: Record<ShowcaseCoverPhotoSlotSize, number> = {
    hero: 160,
    large: 144,
    grid: 112,
    list: 56,
    branch: 48,
    table: 32,
  };
  const dealerAvatarShape: "circle" | "square" =
    size === "hero" || size === "large" || size === "grid" ? "square" : "circle";
  const dealerAvatarRoundClass =
    dealerAvatarShape === "square" ? "rounded-2xl" : undefined;

  return (
    <>
      <div className={cn("group", frameClass[size], className)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <div className={cn("absolute inset-0 overflow-hidden border border-border bg-card", roundCn)}>
          {hasImage ? (
            <div className="absolute inset-0" data-testid={imageTestId}>
              <SafeImage src={displaySrc} alt="" className="absolute inset-0 h-full w-full" objectFit="cover" />
            </div>
          ) : kind === "dealer" ? (
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center bg-card p-1",
                !canEditGallery && "opacity-90",
              )}
              data-testid={placeholderTestId}
            >
              <ClientAvatar
                name={dealer.name}
                seed={dealer.id || dealer.actualizationInn || dealer.name}
                size={dealerAvatarSizeBySlot[size]}
                shape={dealerAvatarShape}
                className={dealerAvatarRoundClass}
              />
            </div>
          ) : (
            <div
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-muted/40 p-1 text-center text-muted-foreground",
                !canEditGallery && "opacity-90",
                isTinyThumb && "gap-0 p-0.5",
              )}
              data-testid={placeholderTestId}
            >
              <Camera className={cn("shrink-0 text-primary", isTinyThumb ? "h-3.5 w-3.5" : "h-5 w-5")} aria-hidden />
              {showTwoLinePlaceholder ? (
                <>
                  <span
                    className={cn(
                      "line-clamp-2 px-0.5 text-center font-medium leading-tight text-foreground",
                      size === "list" ? "text-[8px]" : "text-[10px]",
                    )}
                  >
                    {placeholderTitle}
                  </span>
                  {size !== "list" ? (
                    <span className="line-clamp-2 px-0.5 text-center text-[9px] leading-tight text-muted-foreground">
                      {placeholderSubtitle}
                    </span>
                  ) : null}
                </>
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
              className={cn(
                "absolute right-0.5 top-0.5 z-[2] h-9 w-9 min-h-9 min-w-9 border border-border bg-card/95 p-0 text-foreground shadow-sm transition-opacity",
                "max-sm:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
                "hover:bg-[#86B832]/20",
              )}
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
            entityName={kind === "dealer" ? dealer.name : tp!.name}
            entitySeed={kind === "dealer" ? dealer.id || dealer.actualizationInn || undefined : tp!.id}
            canEdit={canEditGallery}
            profile={profile}
            compact
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
