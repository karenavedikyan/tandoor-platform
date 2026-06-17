import { Skeleton } from "@/components/ui/skeleton";

/** Каркас /products/:productId (демо-каталог). */
export function ProductDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-3 py-4 sm:px-4" data-testid="page-skeleton">
      <Skeleton className="h-6 w-32" />
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-4">
          <Skeleton className="aspect-[4/3] w-full max-w-md rounded-2xl" />
          <Skeleton className="h-8 w-full max-w-lg" />
          <Skeleton className="h-4 w-48" />
          <div className="flex gap-2 overflow-hidden lg:hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 shrink-0 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
        <div className="hidden w-56 shrink-0 space-y-2 lg:block">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
