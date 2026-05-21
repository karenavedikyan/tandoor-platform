"use client";

import type { ReactElement } from "react";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { SafeImage } from "@/components/safe-image";
import { cn } from "@/lib/utils";

function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

const sizeClass: Record<"xs" | "sm" | "md", string> = {
  xs: "h-10 w-10 min-h-10 min-w-10 text-[11px]",
  sm: "h-10 w-10 min-h-10 min-w-10 text-xs",
  md: "h-14 w-14 min-h-14 min-w-14 text-sm",
};

/**
 * Превью клиента в списках: обложка из актуализации, иначе legacy logoUrl, иначе инициалы.
 */
export function DealerRowListAvatar(props: { row: DealerRow; size?: "xs" | "sm" | "md"; className?: string }): ReactElement {
  const { row, size = "md", className } = props;
  const thumb = row.coverPhotoThumbnailUrl?.trim() || row.coverPhotoUrl?.trim();
  const logo = (row as DealerRow & { logoUrl?: string }).logoUrl?.trim();
  const src = thumb || logo || "";
  const sz = sizeClass[size];
  if (src) {
    return (
      <div
        className={cn("relative shrink-0 overflow-hidden rounded-md border border-border bg-card", sz, className)}
        data-testid={`dealer-list-avatar-img-${row.id}`}
      >
        <SafeImage src={src} alt="" className="absolute inset-0 h-full w-full" objectFit="cover" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 font-bold text-foreground",
        sz,
        className,
      )}
      data-testid={`dealer-list-avatar-fallback-${row.id}`}
    >
      {initialsFromName(row.name)}
    </div>
  );
}
