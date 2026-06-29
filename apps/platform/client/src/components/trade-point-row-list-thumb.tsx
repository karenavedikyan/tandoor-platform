"use client";

import type { ReactElement } from "react";
import type { DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { tradePointDisplayLabel } from "@/lib/trade-point-display-labels";
import { SafeImage } from "@/components/safe-image";
import { cn } from "@/lib/utils";

function initialsFromTpName(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t.slice(0, 2).toUpperCase();
}

const sizeClass: Record<"xs" | "sm", string> = {
  xs: "h-10 w-10 min-h-10 min-w-10 text-[10px]",
  sm: "h-12 w-12 min-h-12 min-w-12 text-xs",
};

export function TradePointRowListThumb(props: {
  point: DealerTradePoint;
  size?: "xs" | "sm";
  className?: string;
}): ReactElement {
  const { point, size = "xs", className } = props;
  const src = point.coverPhotoThumbnailUrl?.trim() || point.coverPhotoUrl?.trim();
  const sz = sizeClass[size];
  if (src) {
    return (
      <div
        className={cn("relative shrink-0 overflow-hidden rounded-md border border-border bg-card", sz, className)}
        data-testid={`trade-point-list-thumb-${point.id}`}
      >
        <SafeImage src={src} alt="" className="absolute inset-0 h-full w-full" objectFit="cover" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border border-border bg-muted font-semibold text-muted-foreground",
        sz,
        className,
      )}
      data-testid={`trade-point-list-thumb-fallback-${point.id}`}
    >
      {initialsFromTpName(tradePointDisplayLabel(point))}
    </div>
  );
}
