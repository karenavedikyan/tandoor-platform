import { Skeleton } from "@/components/ui/skeleton";

/** Каркас /dealers/:dealerId/trade-points/:pointId. */
export function TradePointDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-3 py-4 sm:px-4" data-testid="page-skeleton">
      <Skeleton className="h-6 w-56" />
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex gap-4">
            <Skeleton className="h-28 w-28 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-8 w-full max-w-sm" />
              <Skeleton className="h-4 w-40" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex gap-2 overflow-hidden lg:hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
        <div className="hidden w-56 shrink-0 space-y-2 lg:block">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
