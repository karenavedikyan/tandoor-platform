import { Skeleton } from "@/components/ui/skeleton";

/** Каркас /training-wiki-map. */
export function TrainingWikiMapSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6" data-testid="page-skeleton">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid h-auto w-full max-w-lg grid-cols-2 gap-1 rounded-lg border border-border p-1">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-40 rounded-md" />
        <Skeleton className="h-10 w-48 rounded-md" />
        <Skeleton className="h-10 flex-1 min-w-[12rem] rounded-md" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
