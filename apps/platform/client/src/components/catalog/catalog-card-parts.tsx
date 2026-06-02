import { GitCompare, Heart, ListChecks } from "lucide-react";
import { optimizedImage } from "@/lib/catalog-image";
import { cn } from "@/lib/utils";
import type { CatalogListProduct } from "./ProductListRow";

export function formatCatalogPrice(n: number | null): string {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
}

export function formatCatalogStock(n: number | null): string {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("ru-RU");
}

export function saleDiscountPercent(retail: number | null, sale: number | null): number | null {
  if (retail == null || sale == null || retail <= 0 || sale >= retail) return null;
  return Math.round(((retail - sale) / retail) * 100);
}

type BadgeTone = "sale" | "new" | "hit";

const BADGE_STYLES: Record<BadgeTone, string> = {
  sale: "bg-rose-600 text-white",
  new: "bg-lime-500 text-lime-950",
  hit: "bg-amber-500 text-amber-950",
};

function PhotoBadge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-sm",
        BADGE_STYLES[tone],
      )}
    >
      {children}
    </span>
  );
}

export function CatalogPhotoBadges({
  product,
  priceRetail,
  priceRetailSale,
  compact,
}: {
  product: CatalogListProduct;
  priceRetail: number | null;
  priceRetailSale: number | null;
  compact?: boolean;
}) {
  const pct = saleDiscountPercent(priceRetail, priceRetailSale);
  const showSale = pct != null && pct > 0;

  return (
    <div className={cn("flex flex-col items-start gap-1", compact && "gap-0.5")}>
      {showSale ? <PhotoBadge tone="sale">−{pct}%</PhotoBadge> : null}
      {product.is_new ? <PhotoBadge tone="new">Новинка</PhotoBadge> : null}
      {product.is_hit ? <PhotoBadge tone="hit">Хит</PhotoBadge> : null}
      {!showSale && product.is_sale ? <PhotoBadge tone="sale">Акция</PhotoBadge> : null}
    </div>
  );
}

export function CatalogActionIcons({ compact }: { compact?: boolean }) {
  const btn = cn(
    "flex items-center justify-center rounded-full border border-border/80 bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm transition hover:bg-muted hover:text-foreground",
    compact ? "h-7 w-7" : "h-8 w-8",
  );
  return (
    <div className="flex flex-col gap-1">
      <button type="button" className={btn} aria-label="В избранное" onClick={(e) => e.preventDefault()}>
        <Heart className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </button>
      <button type="button" className={btn} aria-label="Сравнить" onClick={(e) => e.preventDefault()}>
        <GitCompare className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </button>
    </div>
  );
}

export function CatalogSpecsButton({
  visible,
  compact,
  onClick,
}: {
  visible: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-lime-500 px-2 py-1 text-[11px] font-medium text-lime-950 shadow-sm transition hover:bg-lime-400",
        compact && "px-1.5 py-0.5 text-[10px]",
      )}
    >
      <ListChecks className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
      Характеристики
    </button>
  );
}

export function CatalogColorPalette({
  colors,
  variants,
  selectedColor,
  onSelect,
  compact,
}: {
  colors: Array<{ value: string; product_id: string; image_url?: string | null }>;
  variants: Array<{ color: string | null; image_url: string | null }>;
  selectedColor: string | null | undefined;
  onSelect: (color: string) => void;
  compact?: boolean;
}) {
  if (colors.length <= 1) return null;

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className={cn("Palette flex gap-1.5 overflow-x-auto pb-1", compact && "gap-1")} onClick={stop}>
      {colors.map((c) => {
        const active = selectedColor === c.value;
        const thumbRaw = c.image_url ?? variants.find((v) => v.color === c.value)?.image_url;
        const thumb = optimizedImage(thumbRaw, 96);
        return (
          <button
            key={c.value}
            type="button"
            title={c.value}
            className={cn(
              "shrink-0 overflow-hidden rounded-md border-2 bg-white transition",
              compact ? "h-8 w-8" : "h-10 w-10",
              active ? "border-lime-500 ring-1 ring-lime-500/40" : "border-border hover:border-muted-foreground/50",
            )}
            onClick={() => onSelect(c.value)}
          >
            {thumb ? (
              <img src={thumb} alt={c.value} className="h-full w-full object-contain p-0.5" loading="lazy" />
            ) : (
              <span className="flex h-full items-center justify-center px-0.5 text-[9px] text-muted-foreground">
                {c.value.slice(0, 3)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function CatalogPriceBlock({
  priceRetail,
  priceRetailSale,
  align = "left",
  size = "md",
}: {
  priceRetail: number | null;
  priceRetailSale: number | null;
  align?: "left" | "right";
  size?: "md" | "sm";
}) {
  const onSale = priceRetailSale != null;
  const alignCls = align === "right" ? "text-right items-end" : "text-left items-start";
  const mainCls = size === "sm" ? "text-base" : "text-lg font-bold";

  if (onSale) {
    return (
      <div className={cn("flex flex-col gap-0.5", alignCls)}>
        <div className="text-[10px] text-muted-foreground line-through">{formatCatalogPrice(priceRetail)}</div>
        <div className="text-[11px] font-medium text-rose-600">Акционная цена</div>
        <div className={cn("tabular-nums text-rose-600", mainCls)}>{formatCatalogPrice(priceRetailSale)}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-0.5", alignCls)}>
      <div className="text-[11px] text-muted-foreground">Розничная цена</div>
      <div className={cn("tabular-nums text-foreground", mainCls)}>{formatCatalogPrice(priceRetail)}</div>
    </div>
  );
}

export function CatalogStockLine({
  stock,
  className,
}: {
  stock: number | null;
  className?: string;
}) {
  const n = stock ?? 0;
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      В наличии:{" "}
      <span className={cn("font-medium", n > 0 ? "text-foreground" : "text-muted-foreground")}>
        {formatCatalogStock(stock)}
      </span>
    </p>
  );
}

export function showSpecsButton(product: CatalogListProduct): boolean {
  return (
    (product.door_types?.length ?? 0) > 0 ||
    (product.sides?.length ?? 0) > 0 ||
    ((product.sizes?.length ?? 0) > 0 && (product.door_types?.length ?? 0) > 0)
  );
}
