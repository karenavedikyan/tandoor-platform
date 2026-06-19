import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CategoryChips } from "./CategoryChips";
import { FilterCheckboxGroup, type FilterCheckboxOption } from "./FilterCheckboxGroup";
import type { CatalogCategoryItem } from "./CategoryTreeNav";

export type CatalogFilterFacet = {
  key: string;
  label: string;
  kind?: "checkbox" | "range_buckets" | "boolean";
  options: FilterCheckboxOption[];
};

export type CatalogFiltersValue = Record<string, string[]>;

export type CatalogFiltersPanelProps = {
  categories?: { id: string; label: string; count?: number }[];
  selectedCategories: string[];
  onCategoriesChange: (next: string[]) => void;
  /** Одна категория за раз (как на /catalog). */
  singleCategory?: boolean;

  facets: CatalogFilterFacet[];
  value: CatalogFiltersValue;
  onChange: (key: string, next: string[]) => void;

  query?: string;
  onQueryChange?: (q: string) => void;
  queryPlaceholder?: string;

  onResetAll: () => void;
  activeCount?: number;

  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  "data-testid"?: string;
};

function MultiCategoryChips({
  categories,
  selected,
  onChange,
}: {
  categories: { id: string; label: string; count?: number }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  if (categories.length === 0) return null;
  return (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Категории"
      data-testid="catalog-filters-category-chips"
    >
      {categories.map((c) => {
        const active = selected.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={active}
            data-testid={`catalog-filters-category-${c.id}`}
            onClick={() => {
              if (active) onChange(selected.filter((id) => id !== c.id));
              else onChange([...selected, c.id]);
            }}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm",
              active
                ? "border-[#9aca3c] bg-[#9aca3c] text-white shadow-[0_4px_12px_rgba(154,202,60,0.35)]"
                : "border-border bg-card text-foreground hover:border-[#9aca3c] hover:text-[#86b832]",
            )}
          >
            {c.label}
            {c.count != null ? ` (${c.count.toLocaleString("ru-RU")})` : null}
          </button>
        );
      })}
    </div>
  );
}

export function CatalogFiltersPanel({
  categories = [],
  selectedCategories,
  onCategoriesChange,
  singleCategory = false,
  facets,
  value,
  onChange,
  query,
  onQueryChange,
  queryPlaceholder = "Поиск…",
  onResetAll,
  activeCount = 0,
  open = true,
  className,
  "data-testid": testId = "catalog-filters-panel",
}: CatalogFiltersPanelProps) {
  const categoryItems: CatalogCategoryItem[] = useMemo(
    () =>
      categories.map((c) => ({
        id: c.id,
        name: c.label,
        parent_id: null,
        product_count: c.count ?? 0,
        sort_order: null,
      })),
    [categories],
  );

  if (!open) return null;

  return (
    <div
      className={cn("space-y-4 rounded-lg border border-border/80 bg-muted/15 p-3", className)}
      data-testid={testId}
    >
      {onQueryChange != null && query != null ? (
        <div className="space-y-1">
          <Label htmlFor={`${testId}-search`} className="text-xs text-muted-foreground">
            Поиск
          </Label>
          <Input
            id={`${testId}-search`}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={queryPlaceholder}
            className="h-9"
            data-testid="catalog-filters-search"
          />
        </div>
      ) : null}

      {categories.length > 0 ? (
        singleCategory ? (
          <CategoryChips
            categories={categoryItems}
            selectedId={selectedCategories[0] ?? "all"}
            onSelect={(id) => onCategoriesChange(id === "all" ? [] : [id])}
          />
        ) : (
          <MultiCategoryChips
            categories={categories}
            selected={selectedCategories}
            onChange={onCategoriesChange}
          />
        )
      ) : null}

      {facets.map((facet) => (
        <div key={facet.key} className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{facet.label}</p>
          <FilterCheckboxGroup
            label={facet.label}
            kind={facet.kind}
            options={facet.options}
            selected={value[facet.key] ?? []}
            onChange={(next) => onChange(facet.key, next)}
          />
        </div>
      ))}

      {activeCount > 0 ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={onResetAll}
          data-testid="catalog-filters-reset-all"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Сбросить всё
        </Button>
      ) : null}
    </div>
  );
}
