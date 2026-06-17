import { Skeleton } from "@/components/ui/skeleton";

/** Каркас /tasks — задачи по витрине. */
export function TasksSkeleton() {
  return (
    <div
      className="max-md:pb-[calc(5.5rem+env(safe-area-inset-bottom))] min-w-0 max-w-full space-y-4 overflow-x-hidden sm:space-y-6"
      data-testid="page-skeleton"
    >
      <section className="space-y-4 sm:space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-lg sm:p-8">
          <Skeleton className="h-8 w-56 sm:h-9 sm:w-72" />
          <Skeleton className="mt-2 h-4 w-full max-w-lg" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-11 w-full rounded-md" />
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-11 w-full rounded-md" />
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] w-full rounded-xl sm:h-28" />
          ))}
        </div>
      </section>
    </div>
  );
}
