import { Skeleton } from "@/components/ui/skeleton";

/** Каркас /analytics. */
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-8 pb-28 sm:space-y-10" data-testid="page-skeleton">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8">
        <Skeleton className="h-8 w-44 sm:h-9 sm:w-52" />
        <Skeleton className="mt-2 h-4 w-full max-w-lg" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Skeleton className="h-10 w-32 rounded-md" />
          <Skeleton className="h-10 w-36 rounded-md" />
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
      </div>
      <div className="grid h-auto w-full max-w-md grid-cols-2 gap-1 rounded-lg border border-border p-1">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
