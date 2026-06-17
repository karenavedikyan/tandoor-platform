import { Badge } from "../components/ui/badge.js";
import type { SegmentDetailSource } from "./trade-point-showcase-segment-models.js";
import { cn } from "./utils.js";

export function percentBadgeVariant(percent: number): "destructive" | "secondary" | "default" {
  if (percent < 30) return "destructive";
  if (percent < 70) return "secondary";
  return "default";
}

export function percentBadgeClass(percent: number): string {
  if (percent >= 70) {
    return "border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
  }
  if (percent >= 30) {
    return "border-amber-500/30 bg-amber-500/15 text-amber-900 dark:text-amber-200";
  }
  return "";
}

export function DistributionPercentBadge({
  percent,
  className,
}: {
  percent: number;
  className?: string;
}) {
  return (
    <Badge
      variant={percentBadgeVariant(percent)}
      className={cn("font-semibold tabular-nums", percentBadgeClass(percent), className)}
    >
      {percent}%
    </Badge>
  );
}

const SOURCE_LABELS: Record<SegmentDetailSource, string> = {
  blocks: "по блокам",
  models: "по моделям",
  empty: "пусто",
};

export function sourceLabelRu(source: SegmentDetailSource): string {
  return SOURCE_LABELS[source];
}

export function DistributionSourceBadge({
  source,
  className,
}: {
  source: SegmentDetailSource;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("text-xs font-normal", className)}>
      {sourceLabelRu(source)}
    </Badge>
  );
}
