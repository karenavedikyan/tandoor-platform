"use client";

import type { ReactElement } from "react";
import type { DealerTradePoint } from "@/lib/dealer-base-mock-data";
import { SafeImage } from "@/components/safe-image";
import { cn } from "@/lib/utils";

function initialsFromTpName(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t.slice(0, 2).toUpperCase();
}

const sizeClass: Record<"xs" | "sm", string> = {
  xs: "h-9 w-9 min-h-9 min-w-9 text-[10px]",
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
        className={cn("relative shrink-0 overflow-hidden rounded-md border border-[#E3E6F3] bg-[#FFFFFF]", sz, className)}
        data-testid={`trade-point-list-thumb-${point.id}`}
      >
        <SafeImage src={src} alt="" className="absolute inset-0 h-full w-full" objectFit="cover" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border border-[#9ACA3C]/25 bg-[#EEEFF6] font-semibold text-[#8F96B0]",
        sz,
        className,
      )}
      data-testid={`trade-point-list-thumb-fallback-${point.id}`}
    >
      {initialsFromTpName(point.name)}
    </div>
  );
}
