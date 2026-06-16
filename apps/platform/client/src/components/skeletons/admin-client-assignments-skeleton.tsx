import { Skeleton } from "@/components/ui/skeleton";

/** Каркас таблицы назначений клиентов. */
export function AdminClientAssignmentsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6" data-testid="page-skeleton">
      <Skeleton className="h-8 w-64" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-48 rounded-md" />
        <Skeleton className="h-10 w-40 rounded-md" />
      </div>
      <div className="rounded-xl border border-border bg-card">
        <Skeleton className="m-4 h-6 w-40" />
        <div className="border-t border-border px-2">
          <Skeleton className="my-2 h-10 w-full" />
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="mb-2 h-10 w-full rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}
