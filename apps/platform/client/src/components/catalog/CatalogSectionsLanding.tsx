import { useMemo, type ElementType } from "react";
import {
  ChevronRight,
  DoorClosed,
  DoorOpen,
  Folder,
  KeyRound,
  Minus,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CatalogCategoryItem } from "./CategoryTreeNav";

function sortRoots(a: CatalogCategoryItem, b: CatalogCategoryItem): number {
  const sa = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const sb = b.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (sa !== sb) return sa - sb;
  return a.name.localeCompare(b.name, "ru");
}

export function getRootCatalogSections(categories: CatalogCategoryItem[]): CatalogCategoryItem[] {
  return categories.filter((c) => c.parent_id == null && c.product_count > 0).sort(sortRoots);
}

export function sectionIcon(name: string): { Icon: ElementType; className?: string } {
  const n = name.trim().toLowerCase();
  if (n.includes("скидк") || n.includes("акци")) {
    return { Icon: Percent, className: "text-[#d84040]" };
  }
  if (n.includes("входн") || n.includes("противопожар")) {
    return { Icon: DoorClosed };
  }
  if (n.includes("межкомнат")) {
    return { Icon: DoorOpen };
  }
  if (n.includes("плинтус") || n.includes("погонаж")) {
    return { Icon: Minus };
  }
  if (n.includes("фурнитур")) {
    return { Icon: KeyRound };
  }
  return { Icon: Folder };
}

type Props = {
  categories: CatalogCategoryItem[];
  onSelect: (id: string) => void;
};

export function CatalogSectionsLanding({ categories, onSelect }: Props) {
  const roots = useMemo(() => getRootCatalogSections(categories), [categories]);

  if (roots.length === 0) {
    return (
      <div
        className="rounded-lg border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground"
        data-testid="catalog-sections-landing"
      >
        Разделы каталога пока недоступны.
      </div>
    );
  }

  return (
    <nav className="flex flex-col gap-3" aria-label="Разделы каталога" data-testid="catalog-sections-landing">
      {roots.map((section) => {
        const { Icon, className: iconCls } = sectionIcon(section.name);
        return (
          <button
            key={section.id}
            type="button"
            className={cn(
              "flex min-h-16 w-full items-center gap-4 rounded-lg border border-border bg-card px-5 py-4 text-left shadow-sm transition",
              "hover:border-[#9aca3c] hover:bg-muted/50",
            )}
            data-testid={`catalog-section-card-${section.id}`}
            onClick={() => onSelect(section.id)}
          >
            <Icon className={cn("h-7 w-7 shrink-0 text-foreground", iconCls)} aria-hidden />
            <span className="min-w-0 flex-1 text-lg font-semibold leading-snug text-foreground">
              {section.name}
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        );
      })}
    </nav>
  );
}
