import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  resolveCategoryFilterLevels,
  type CatalogCategoryFlat,
} from "@/lib/catalog-category-tree";

type ChipItem = {
  id: string;
  name: string;
  product_count?: number;
};

type ChipRowProps = {
  chips: ChipItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  ariaLabel: string;
  testId: string;
};

function CategoryChipRow({ chips, selectedId, onSelect, ariaLabel, testId }: ChipRowProps) {
  if (chips.length === 0) return null;

  return (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[866px]:flex-wrap min-[866px]:overflow-visible"
      role="tablist"
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {chips.map((chip) => {
        const active = selectedId === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(chip.id)}
            data-testid={`catalog-category-chip-${chip.id}`}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm",
              active
                ? "border-[#9aca3c] bg-[#9aca3c] text-white shadow-[0_4px_12px_rgba(154,202,60,0.35)]"
                : "border-border bg-card text-foreground hover:border-[#9aca3c] hover:text-[#86b832]",
            )}
          >
            {chip.name}
            {chip.product_count != null && chip.product_count > 0
              ? ` (${chip.product_count.toLocaleString("ru-RU")})`
              : null}
          </button>
        );
      })}
    </div>
  );
}

function nodesToChips(nodes: { id: string; name: string; product_count: number }[]): ChipItem[] {
  return nodes.map((n) => ({ id: n.id, name: n.name, product_count: n.product_count }));
}

type Props = {
  categories: CatalogCategoryFlat[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
  "data-testid"?: string;
};

export function CatalogGroupedCategoryFilters({
  categories,
  selectedId,
  onSelect,
  className,
  "data-testid": testId = "catalog-page-category-filters",
}: Props) {
  const levels = useMemo(
    () => resolveCategoryFilterLevels(categories, selectedId),
    [categories, selectedId],
  );

  const rootChips = useMemo(
    () => [{ id: "all", name: "Все" }, ...nodesToChips(levels.roots)],
    [levels.roots],
  );

  const rootSelectedId = selectedId === "all" ? "all" : levels.activeRootId;
  const subsectionSelectedId =
    levels.activeSubsectionId &&
    (selectedId === levels.activeSubsectionId ||
      levels.leaves.some((leaf) => leaf.id === selectedId))
      ? levels.activeSubsectionId
      : selectedId !== "all" &&
          levels.subsections.some((s) => s.id === selectedId)
        ? selectedId
        : levels.activeSubsectionId;

  const leafSelectedId =
    selectedId !== "all" && levels.leaves.some((leaf) => leaf.id === selectedId)
      ? selectedId
      : null;

  const showSubsections = levels.activeRootId != null && levels.subsections.length > 0;
  const showLeaves =
    showSubsections &&
    levels.activeSubsectionId != null &&
    levels.leaves.length > 0;

  return (
    <div className={cn("flex flex-col gap-2", className)} data-testid={testId}>
      <CategoryChipRow
        chips={rootChips}
        selectedId={rootSelectedId}
        onSelect={onSelect}
        ariaLabel="Разделы каталога"
        testId="catalog-category-chips-roots"
      />
      {showSubsections ? (
        <CategoryChipRow
          chips={nodesToChips(levels.subsections)}
          selectedId={subsectionSelectedId}
          onSelect={onSelect}
          ariaLabel="Подразделы"
          testId="catalog-category-chips-subsections"
        />
      ) : null}
      {showLeaves ? (
        <CategoryChipRow
          chips={nodesToChips(levels.leaves)}
          selectedId={leafSelectedId}
          onSelect={onSelect}
          ariaLabel="Категории"
          testId="catalog-category-chips-leaves"
        />
      ) : null}
    </div>
  );
}
