import { Skeleton } from "@/components/ui/skeleton";

/** Каркас /training. */
export function TrainingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6" data-testid="page-skeleton">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-full max-w-lg" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 flex-1 min-w-[12rem] rounded-md" />
        <Skeleton className="h-10 w-40 rounded-md" />
        <Skeleton className="h-10 w-44 rounded-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
