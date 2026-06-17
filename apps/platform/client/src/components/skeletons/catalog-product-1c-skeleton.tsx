import { Skeleton } from "@/components/ui/skeleton";

/** Каркас /catalog/:id (карточка товара 1С). */
export function CatalogProduct1cSkeleton() {
  return (
    <div className="catalog-font space-y-8 p-4 lg:p-6" data-testid="page-skeleton">
      <Skeleton className="h-8 w-24" />
      <div className="flex flex-col gap-6 lg:flex-row">
        <Skeleton className="aspect-square w-full max-w-lg rounded-xl lg:w-1/2" />
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-9 w-full max-w-md" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-36 rounded-md" />
            <Skeleton className="h-10 w-36 rounded-md" />
          </div>
        </div>
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
