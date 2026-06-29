import type { ReactElement } from "react";
import { cn } from "@/lib/utils";
import {
  formatDistributionPercent,
  type DistributionGroupMetrics,
} from "@/lib/distribution-analytics/distribution-analytics-math";

type Props = {
  aggregate: DistributionGroupMetrics;
  testId?: string;
};

/**
 * Плитка «Под ротацию»: число неактуальных (totalLegacyOurs) + взвешенный %
 * (rotationPotentialPercent). Янтарный тон — это объём под замену, не светофор.
 */
export function DistributionRotationTile({ aggregate, testId }: Props): ReactElement {
  const percent = aggregate.rotationPotentialPercent;
  const count = aggregate.totalLegacyOurs;
  const hasRotation = count > 0;
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 shadow-xs" data-testid={testId}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Под ротацию
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          hasRotation
            ? "text-amber-700 dark:text-amber-300"
            : "text-muted-foreground",
        )}
      >
        {formatDistributionPercent(percent)}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
        Неактуальные: {count} шт
      </p>
    </div>
  );
}

/** Компактный янтарный бейдж «N шт · X%» для строк разбивок и гридов. */
export function DistributionRotationBadge({
  count,
  percent,
  testId,
}: {
  count: number;
  percent: number | null;
  testId?: string;
}): ReactElement {
  const hasRotation = count > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        hasRotation
          ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
          : "bg-muted text-muted-foreground",
      )}
      data-testid={testId}
      title="Под ротацию: неактуальные ÷ ёмкость"
    >
      {count} шт · {formatDistributionPercent(percent)}
    </span>
  );
}
