import { Skeleton } from "@/components/ui/skeleton";

/** Каркас /marketing-briefs и детали брифа. */
export function MarketingBriefsSkeleton() {
  return (
    <div className="space-y-4 px-4 py-4 sm:px-6" data-testid="page-skeleton">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-8 w-64" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-36 rounded-md" />
        <Skeleton className="h-10 w-40 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
