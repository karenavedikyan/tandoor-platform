import { Skeleton } from "@/components/ui/skeleton";

/** Каркас /catalog — каталог 1С. */
export function CatalogSkeleton() {
  return (
    <div className="catalog-font space-y-6 p-4 lg:p-6" data-testid="page-skeleton">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 min-w-[12rem] flex-1 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-9 rounded-md" />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 min-[650px]:grid-cols-3 min-[866px]:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-[220px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
