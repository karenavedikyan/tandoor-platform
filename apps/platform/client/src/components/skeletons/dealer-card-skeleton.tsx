import { Skeleton } from "@/components/ui/skeleton";

/** Каркас карточки клиента /dealers/:id. */
export function DealerCardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-4 sm:px-4" data-testid="page-skeleton">
      <Skeleton className="h-6 w-40" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Skeleton className="h-24 w-24 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-8 w-full max-w-md" />
          <Skeleton className="h-4 w-48" />
          <div className="flex flex-wrap gap-2 pt-1">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      </div>
      <div className="flex gap-2 border-b border-border pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
