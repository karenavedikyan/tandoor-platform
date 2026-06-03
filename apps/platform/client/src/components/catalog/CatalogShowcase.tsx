import { useEffect, useMemo, useState } from "react";
import { ProductCardGrid, type CatalogListProduct } from "@/components/catalog/ProductListRow";
import type { CatalogCategoryItem } from "@/components/catalog/CategoryTreeNav";
import { cn } from "@/lib/utils";

export type ShowcaseBadge = "sale" | "hit" | "new";
export type ShowcaseCardSize = "xl" | "m" | "s";

const SHELF_SLIDE_WIDTH: Record<ShowcaseCardSize, string> = {
  xl: "w-[240px] sm:w-[280px]",
  m: "w-[160px] sm:w-[200px]",
  s: "w-[132px] sm:w-[150px]",
};

const SHELF_SKELETON_HEIGHT: Record<ShowcaseCardSize, string> = {
  xl: "h-[420px]",
  m: "h-[300px]",
  s: "h-[240px]",
};

type ShowcaseRow = {
  key: string;
  title: string;
  categoryId: string;
  badge: ShowcaseBadge;
};

type Props = {
  categories: CatalogCategoryItem[];
  onOpenSelection: (categoryId: string, badge: ShowcaseBadge) => void;
  cardSize: ShowcaseCardSize;
};

const SALE_CATEGORY_PATTERNS: { pattern: RegExp; fallbackLabel: string }[] = [
  { pattern: /входн/, fallbackLabel: "Входные двери" },
  { pattern: /межкомнат/, fallbackLabel: "Межкомнатные двери" },
  { pattern: /фурнитур/, fallbackLabel: "Фурнитура" },
];

function buildShowcaseRows(categories: CatalogCategoryItem[]): ShowcaseRow[] {
  const roots = categories.filter((c) => c.parent_id == null && c.product_count > 0);
  const rows: ShowcaseRow[] = [];

  for (const { pattern, fallbackLabel } of SALE_CATEGORY_PATTERNS) {
    const cat = roots.find((c) => pattern.test(c.name.trim().toLowerCase()));
    if (!cat) continue;
    rows.push({
      key: `sale-${cat.id}`,
      title: `Акции · ${cat.name.trim() || fallbackLabel}`,
      categoryId: cat.id,
      badge: "sale",
    });
  }

  return rows;
}

function badgeParam(badge: ShowcaseBadge): string {
  if (badge === "sale") return "is_sale";
  if (badge === "hit") return "is_hit";
  return "is_new";
}

function ShowcaseShelf({
  row,
  onOpenSelection,
  cardSize,
}: {
  row: ShowcaseRow;
  onOpenSelection: Props["onOpenSelection"];
  cardSize: ShowcaseCardSize;
}) {
  const [items, setItems] = useState<CatalogListProduct[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("category_id", row.categoryId);
        params.set(badgeParam(row.badge), "1");
        params.set("limit", "12");
        const r = await fetch(`/api/catalog/products?${params}`, { credentials: "include" });
        const data = await r.json();
        if (!cancelled) {
          if (r.ok && data.success) {
            setItems((data.items ?? []) as CatalogListProduct[]);
          } else {
            setItems([]);
          }
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [row.categoryId, row.badge]);

  if (!loading && (!items || items.length === 0)) {
    return null;
  }

  return (
    <section aria-labelledby={`showcase-${row.key}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={`showcase-${row.key}`} className="text-lg font-semibold leading-snug text-foreground">
          {row.title}
        </h2>
        <button
          type="button"
          className="shrink-0 text-sm font-medium text-[#9aca3c] hover:underline"
          onClick={() => onOpenSelection(row.categoryId, row.badge)}
        >
          Смотреть все →
        </button>
      </div>
      {loading ? (
        <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin]">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className={cn(
                SHELF_SLIDE_WIDTH[cardSize],
                SHELF_SKELETON_HEIGHT[cardSize],
                "shrink-0 rounded-[15px] bg-muted animate-pulse",
              )}
              aria-hidden
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:thin]">
          {items!.map((p) => (
            <div key={p.id} className={cn(SHELF_SLIDE_WIDTH[cardSize], "shrink-0")}>
              <ProductCardGrid product={p} size={cardSize} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function CatalogShowcase({ categories, onOpenSelection, cardSize }: Props) {
  const rows = useMemo(() => buildShowcaseRows(categories), [categories]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8" data-testid="catalog-showcase">
      {rows.map((row) => (
        <ShowcaseShelf
          key={row.key}
          row={row}
          cardSize={cardSize}
          onOpenSelection={onOpenSelection}
        />
      ))}
    </div>
  );
}
