import { Skeleton } from "@/components/ui/skeleton";

/** Каркас /trade-points (менеджерский список). */
export function TradePointsSkeleton() {
  return (
    <div className="min-w-0 max-w-full space-y-4 px-1 sm:space-y-6 sm:px-0" data-testid="page-skeleton">
      <div className="space-y-2">
        <Skeleton className="h-8 w-52 sm:h-9 sm:w-64" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-md sm:p-4">
        <Skeleton className="mb-3 h-10 w-full rounded-lg" />
        <div className="flex justify-end gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-9 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] w-full rounded-xl sm:h-20" />
        ))}
      </div>
    </div>
  );
}
