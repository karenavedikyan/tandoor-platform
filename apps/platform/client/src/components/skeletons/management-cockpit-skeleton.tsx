import { Skeleton } from "@/components/ui/skeleton";

/** Каркас DealerBaseManagementCockpit / TradePointsManagementCockpit. */
export function ManagementCockpitSkeleton() {
  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden pb-28 sm:pb-10" data-testid="page-skeleton">
      <div className="space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-56 rounded-xl" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
