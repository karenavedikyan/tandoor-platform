import { Flame, GitCompare, DoorOpen, Heart, ListChecks, ShoppingCart } from "lucide-react";
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

function DiscountBadge({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center bg-[#d84040] font-semibold leading-none text-white shadow-sm",
        "rounded-[2px] p-[5px]",
        compact ? "text-sm" : "text-lg",
      )}
    >
      {children}
    </span>
  );
}

function NewBadge({ compact }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        "font-bold uppercase tracking-wide text-[#9aca3c]",
        compact ? "text-[10px]" : "text-[11px]",
      )}
    >
      NEW
    </span>
  );
}

function HitBadge({ compact }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[2px] bg-[#d84040] px-1.5 py-0.5 font-semibold leading-none text-white shadow-sm",
        compact ? "text-[10px]" : "text-xs",
      )}
    >
      <Flame className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden />
      Хит
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
      {showSale ? <DiscountBadge compact={compact}>−{pct}%</DiscountBadge> : null}
      {product.is_new ? <NewBadge compact={compact} /> : null}
      {product.is_hit ? <HitBadge compact={compact} /> : null}
      {!showSale && product.is_sale ? <DiscountBadge compact={compact}>Акция</DiscountBadge> : null}
    </div>
  );
}

export function CatalogCardActionsRow({ compact }: { compact?: boolean }) {
  const icon = cn("transition", compact ? "h-4 w-4" : "h-5 w-5");
  const btn = "text-muted-foreground transition hover:text-[#9aca3c]";
  return (
    <div className="flex items-center justify-between border-t border-border/40 pt-2">
      <div className="flex items-center gap-3">
        <button type="button" className={btn} aria-label="В избранное" onClick={(e) => e.preventDefault()}>
          <Heart className={icon} />
        </button>
        <button type="button" className={btn} aria-label="Сравнить" onClick={(e) => e.preventDefault()}>
          <GitCompare className={icon} />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className={btn} aria-label="В проём" onClick={(e) => e.preventDefault()}>
          <DoorOpen className={icon} />
        </button>
        <button type="button" className={btn} aria-label="В корзину" onClick={(e) => e.preventDefault()}>
          <ShoppingCart className={icon} />
        </button>
      </div>
    </div>
  );
}

export function CatalogActionIcons({ compact }: { compact?: boolean }) {
  const btn = cn(
    "flex items-center justify-center rounded-full border border-border bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm transition hover:bg-muted hover:text-[#9aca3c]",
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
        "inline-flex items-center gap-1 rounded-md bg-[#9aca3c] px-2 py-1 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#8ab835]",
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
              active
                ? "border-[#9aca3c] ring-1 ring-[#9aca3c]/40"
                : "border-border hover:border-muted-foreground/50",
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
  const priceCls =
    size === "sm"
      ? "text-lg font-semibold leading-[22px] tabular-nums"
      : "text-[22px] font-semibold leading-[26px] tabular-nums";
  const labelCls = cn("text-[11px] font-medium text-[#9aca3c]", size === "sm" && "text-[10px]");
  const alignEnd = align === "right";

  if (onSale) {
    return (
      <div
        className={cn(
          "Card-product__retail-price flex w-full flex-col justify-center gap-0.5",
          size === "md" ? "min-h-[52px] items-start py-1" : "min-h-[52px]",
          size === "sm" && (alignEnd ? "items-end" : "items-start"),
        )}
      >
        <span className={cn("text-muted-foreground line-through", size === "sm" ? "text-[9px]" : "text-[10px]")}>
          {formatCatalogPrice(priceRetail)}
        </span>
        {size === "sm" ? (
          <div className={cn("flex w-full gap-2", alignEnd ? "flex-row-reverse justify-end" : "justify-between")}>
            <span className={labelCls}>Акционная цена</span>
            <span className={cn(priceCls, "text-[#d84040]")}>{formatCatalogPrice(priceRetailSale)}</span>
          </div>
        ) : (
          <span className={cn(priceCls, "text-[#d84040]")}>{formatCatalogPrice(priceRetailSale)}</span>
        )}
      </div>
    );
  }

  if (size === "md") {
    return (
      <div className="Card-product__retail-price flex w-full items-start py-1">
        <span className={cn(priceCls, "text-[#9aca3c]")}>{formatCatalogPrice(priceRetail)}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "Card-product__retail-price flex w-full min-h-[52px] items-center gap-2 py-1",
        alignEnd ? "flex-row-reverse justify-end text-right" : "justify-between text-left",
      )}
    >
      <span className={labelCls}>Розничная цена</span>
      <span className={cn(priceCls, "text-[#9aca3c]")}>{formatCatalogPrice(priceRetail)}</span>
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
