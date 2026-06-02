import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  resolveCatalogVariant,
  selectionFromVariant,
  type CatalogVariant,
  type VariantSelection,
} from "@/lib/catalog-variant-resolve";
import { VariantSwitchers } from "./VariantSwitchers";

export type CatalogListProduct = {
  id: string;
  name: string;
  display_name: string | null;
  brand: string | null;
  image_url?: string | null;
  total_stock: number | null;
  price_retail: number | null;
  price_retail_sale: number | null;
  is_new: boolean;
  is_hit: boolean;
  is_sale: boolean;
  variant_count?: number;
  sizes?: Array<{ value: string; product_id: string; image_url?: string | null }>;
  colors?: Array<{ value: string; product_id: string; image_url?: string | null }>;
  door_types?: Array<{ value: string; product_id: string }>;
  sides?: Array<{ value: string; product_id: string }>;
  variants?: CatalogVariant[];
};

function formatStock(n: number | null): string {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("ru-RU");
}

function formatPrice(n: number | null): string {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
}

function ProductBadges({ p }: { p: CatalogListProduct }) {
  return (
    <>
      {p.is_new && (
        <Badge className="bg-emerald-600 px-1.5 py-0 text-[10px] text-white hover:bg-emerald-600">New</Badge>
      )}
      {p.is_hit && (
        <Badge className="bg-amber-500 px-1.5 py-0 text-[10px] text-white hover:bg-amber-500">Hit</Badge>
      )}
      {p.is_sale && (
        <Badge className="bg-rose-600 px-1.5 py-0 text-[10px] text-white hover:bg-rose-600">Sale</Badge>
      )}
    </>
  );
}

function PriceBlock({ priceRetail, priceRetailSale }: { priceRetail: number | null; priceRetailSale: number | null }) {
  if (priceRetailSale != null) {
    return (
      <div className="text-right">
        <div className="font-semibold text-rose-600">{formatPrice(priceRetailSale)}</div>
        {priceRetail != null ? (
          <div className="text-xs text-muted-foreground line-through">{formatPrice(priceRetail)}</div>
        ) : null}
      </div>
    );
  }
  return <div className="font-semibold">{formatPrice(priceRetail)}</div>;
}

function useVariantDisplay(product: CatalogListProduct) {
  const variants = product.variants ?? [];
  const repVariant = useMemo(
    () =>
      variants.find((v) => v.product_id === product.id) ??
      ({
        product_id: product.id,
        size: null,
        color: null,
        door_type: null,
        side: null,
        price_retail: product.price_retail,
        price_retail_sale: product.price_retail_sale,
        image_url: product.image_url ?? null,
        total_stock: product.total_stock,
      } satisfies CatalogVariant),
    [variants, product],
  );

  const [selection, setSelection] = useState<VariantSelection>(() => selectionFromVariant(repVariant));

  useEffect(() => {
    setSelection(selectionFromVariant(repVariant));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when card data changes
  }, [product.id]);

  const active = useMemo(
    () => resolveCatalogVariant(variants, selection, product.id) ?? repVariant,
    [variants, selection, product.id, repVariant],
  );

  const showSwitchers =
    variants.length > 1 &&
    ((product.sizes?.length ?? 0) > 1 ||
      (product.colors?.length ?? 0) > 1 ||
      (product.door_types?.length ?? 0) > 1 ||
      (product.sides?.length ?? 0) > 1);

  return { active, selection, setSelection, showSwitchers, variants };
}

export function ProductListRow({ product }: { product: CatalogListProduct }) {
  const { active, selection, setSelection, showSwitchers, variants } = useVariantDisplay(product);
  const imageSrc = active.image_url || product.image_url || null;

  return (
    <div className="flex flex-col gap-1 px-3 py-2.5 hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-3">
      <Link
        href={`/catalog/1c/${active.product_id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
        data-testid={`catalog-row-${product.id}`}
      >
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-white">
          {imageSrc ? (
            <img src={imageSrc} alt={product.name} className="h-full w-full object-contain p-1" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">Нет фото</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-medium">{product.display_name || product.name}</span>
            <ProductBadges p={product} />
          </div>
          {product.brand ? (
            <div className="truncate text-xs text-muted-foreground">{product.brand}</div>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <PriceBlock priceRetail={active.price_retail} priceRetailSale={active.price_retail_sale} />
            <Badge variant="secondary" className="text-xs">
              {formatStock(active.total_stock)}
            </Badge>
          </div>
        </div>
      </Link>
      {showSwitchers ? (
        <div className="shrink-0 pl-[5.25rem] sm:pl-0">
          <VariantSwitchers
            compact
            variants={variants}
            selection={selection}
            onSelectionChange={setSelection}
            sizes={product.sizes ?? []}
            colors={product.colors ?? []}
            doorTypes={product.door_types ?? []}
            sides={product.sides ?? []}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ProductCardGrid({
  product,
  size,
}: {
  product: CatalogListProduct;
  size: "xl" | "m" | "s";
}) {
  const { active, selection, setSelection, showSwitchers, variants } = useVariantDisplay(product);
  const imageSrc = active.image_url || product.image_url || null;

  const titleCls = size === "xl" ? "text-base" : size === "m" ? "text-sm" : "text-xs";
  const brandCls = size === "xl" ? "text-sm" : size === "m" ? "text-xs" : "hidden";
  const pad = size === "s" ? "p-2" : "p-3";
  const imgPad = size === "s" ? "p-1" : "p-2";
  const detailHref = `/catalog/1c/${active.product_id}`;

  return (
    <div
      className={cn("h-full overflow-hidden rounded-lg border bg-card transition hover:shadow-md")}
      data-testid={`catalog-card-${product.id}`}
    >
      <Link href={detailHref} className="block">
        <div className="relative aspect-square w-full overflow-hidden bg-white">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={product.name}
              className={cn("h-full w-full object-contain", imgPad)}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Фото в 1С отсутствует
            </div>
          )}
          <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
            <ProductBadges p={product} />
          </div>
        </div>
      </Link>

      {showSwitchers && size !== "s" ? (
        <div className={cn("border-t border-border/50", pad, "pt-2")}>
          <VariantSwitchers
            variants={variants}
            selection={selection}
            onSelectionChange={setSelection}
            sizes={product.sizes ?? []}
            colors={product.colors ?? []}
            doorTypes={product.door_types ?? []}
            sides={product.sides ?? []}
            compact={size === "m"}
          />
        </div>
      ) : null}

      <Link href={detailHref} className={cn("block space-y-1", pad, showSwitchers && size !== "s" && "pt-0")}>
        <div className={cn("line-clamp-2 font-medium", titleCls)} title={product.display_name || product.name}>
          {product.display_name || product.name}
        </div>
        {product.brand && brandCls !== "hidden" ? (
          <div className={cn("truncate text-muted-foreground", brandCls)}>{product.brand}</div>
        ) : null}
        <div className="flex items-end justify-between gap-1">
          <PriceBlock priceRetail={active.price_retail} priceRetailSale={active.price_retail_sale} />
          {size !== "s" ? (
            <Badge variant="secondary" className="shrink-0 text-xs">
              {formatStock(active.total_stock)}
            </Badge>
          ) : (
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                (active.total_stock ?? 0) > 0 ? "bg-emerald-500" : "bg-muted-foreground/40",
              )}
              title={formatStock(active.total_stock)}
            />
          )}
        </div>
      </Link>
    </div>
  );
}
