import { Skeleton } from "@/components/ui/skeleton";

/** Каркас /trash — вкладки, сводка, список карточек. */
export function TrashBinSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6" data-testid="page-skeleton">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-[100px] w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
