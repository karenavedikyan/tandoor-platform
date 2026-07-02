import type { ReactElement } from "react";
import { cn } from "@/lib/utils";

const TANDOOR_TRIANGLE_PATH =
  "M2148.61 0V2047H0V2001.93L335.677 1682.24L457.742 1566.06L2104.23 0H2148.61ZM1038.93 1610.42H1718.61V965.406L1038.93 1610.42Z";

export type BrandDistributionLoaderProgress = {
  loadedBuckets: number;
  totalBuckets: number;
  prefetching: boolean;
};

export type BrandDistributionLoaderProps = {
  progress?: BrandDistributionLoaderProgress;
  className?: string;
  /** Для data-testid совместимости с прежним скелетоном: section-{prefix}-distribution-loading */
  testIdPrefix?: string;
};

function TandoorTriangleMark({ className }: { className?: string }): ReactElement {
  const gradientId = "brand-triangle-stroke-gradient";
  return (
    <svg
      viewBox="0 0 2150 2047"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="2150" y1="1023.5" x2="0" y2="1023.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="hsl(var(--border))" />
          <stop offset="0.925" stopColor="hsl(var(--muted-foreground) / 0.45)" />
        </linearGradient>
        <linearGradient id="brand-triangle-shimmer" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--primary) / 0.55)" />
          <stop offset="45%" stopColor="hsl(var(--primary))" />
          <stop offset="55%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(var(--primary) / 0.55)" />
        </linearGradient>
      </defs>
      <path
        d={TANDOOR_TRIANGLE_PATH}
        className="fill-primary motion-reduce:animate-pulse motion-safe:animate-brand-glow"
      />
      <path
        d={TANDOOR_TRIANGLE_PATH}
        className="motion-safe:animate-brand-shimmer motion-reduce:hidden"
        fill="url(#brand-triangle-shimmer)"
        style={{ mixBlendMode: "soft-light" }}
        opacity={0.65}
      />
      <path d={TANDOOR_TRIANGLE_PATH} stroke={`url(#${gradientId})`} strokeWidth={8} fill="none" />
    </svg>
  );
}

export function BrandDistributionLoader({
  progress,
  className,
  testIdPrefix,
}: BrandDistributionLoaderProps): ReactElement {
  const showProgress = Boolean(progress && progress.totalBuckets > 0);
  const progressPct = showProgress
    ? Math.min(100, Math.max(0, (progress!.loadedBuckets / progress!.totalBuckets) * 100))
    : 0;

  return (
    <div
      className={cn("rounded-xl border border-border/70 bg-card p-4 shadow-xs", className)}
      data-testid={testIdPrefix ? `section-${testIdPrefix}-distribution-loading` : undefined}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex min-h-[7.5rem] flex-col items-center justify-center gap-3 py-1 sm:min-h-[8rem]">
        <TandoorTriangleMark className="h-11 w-11 shrink-0 sm:h-14 sm:w-14" />
        <p className="max-w-sm text-center text-[11px] leading-snug text-muted-foreground sm:text-xs">
          Готовим точные данные по команде…
        </p>
        {showProgress ? (
          <div className="w-full max-w-xs space-y-1.5" data-testid="brand-distribution-loader-rop-progress">
            <p className="text-center text-[10px] tabular-nums text-muted-foreground">
              РОПов {progress!.loadedBuckets} из {progress!.totalBuckets}
            </p>
            <div
              className="h-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress!.totalBuckets}
              aria-valuenow={progress!.loadedBuckets}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
