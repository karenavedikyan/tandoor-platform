import { Skeleton } from "@/components/ui/skeleton";

/** Каркас панели директора (sales-control-director). */
export function SalesControlDirectorSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6" data-testid="page-skeleton">
      <Skeleton className="h-8 w-80" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-40 rounded-md" />
        <Skeleton className="h-10 w-48 rounded-md" />
        <Skeleton className="h-10 w-48 rounded-md" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card">
        <Skeleton className="m-4 h-6 w-48" />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="mx-4 mb-2 h-10 w-[calc(100%-2rem)] rounded-md" />
        ))}
      </div>
    </div>
  );
}
