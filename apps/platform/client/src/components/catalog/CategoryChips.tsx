import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CatalogCategoryItem } from "./CategoryTreeNav";

function sortRoots(a: CatalogCategoryItem, b: CatalogCategoryItem): number {
  const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (sa !== sb) return sa - sb;
  return a.name.localeCompare(b.name, "ru");
}

type Props = {
  categories: CatalogCategoryItem[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function CategoryChips({ categories, selectedId, onSelect }: Props) {
  const roots = useMemo(
    () => categories.filter((c) => c.parent_id == null && c.product_count > 0).sort(sortRoots),
    [categories],
  );

  if (roots.length === 0) return null;

  const chips = [{ id: "all", name: "Все", product_count: 0 }, ...roots];

  return (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[866px]:flex-wrap min-[866px]:overflow-visible"
      role="tablist"
      aria-label="Категории каталога"
      data-testid="catalog-category-chips"
    >
      {chips.map((c) => {
        const active = selectedId === c.id;
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(c.id)}
            data-testid={`catalog-category-chip-${c.id}`}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm",
              active
                ? "border-[#9aca3c] bg-[#9aca3c] text-white shadow-[0_4px_12px_rgba(154,202,60,0.35)]"
                : "border-border bg-card text-foreground hover:border-[#9aca3c] hover:text-[#86b832]",
            )}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
