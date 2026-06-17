import { Skeleton } from "@/components/ui/skeleton";

/** Каркас /communications. */
export function CommunicationsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6" data-testid="page-skeleton">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-32" />
      <div className="grid min-h-[420px] gap-4 lg:grid-cols-[minmax(0,280px)_1fr]">
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <Skeleton className="mb-4 h-6 w-40" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-3/4 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
