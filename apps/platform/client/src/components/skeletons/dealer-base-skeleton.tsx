import { Skeleton } from "@/components/ui/skeleton";

/** Каркас /dealer-base: заголовок, KPI, фильтры, таблица. */
export function DealerBaseSkeleton() {
  return (
    <div className="min-w-0 max-w-full space-y-6 sm:space-y-8" data-testid="page-skeleton">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56 sm:h-10 sm:w-72" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[72px] rounded-xl sm:h-20" />
        ))}
      </div>
      <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-md sm:p-4">
        <Skeleton className="mb-3 h-10 w-full rounded-lg" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      <div className="space-y-2 rounded-xl border border-border/70 bg-card p-2">
        <Skeleton className="mx-2 h-10 w-full max-w-xs" />
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
