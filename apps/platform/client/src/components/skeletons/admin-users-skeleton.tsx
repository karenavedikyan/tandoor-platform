import { Skeleton } from "@/components/ui/skeleton";

/** Каркас /admin-users. */
export function AdminUsersSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6" data-testid="page-skeleton">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-8 w-64" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-48 rounded-md" />
        <Skeleton className="h-10 w-40 rounded-md" />
        <Skeleton className="h-10 flex-1 min-w-[10rem] rounded-md" />
      </div>
      <div className="rounded-xl border border-border bg-card">
        <Skeleton className="m-4 h-6 w-40" />
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="mx-4 mb-2 h-12 w-[calc(100%-2rem)] rounded-md" />
        ))}
      </div>
    </div>
  );
}
