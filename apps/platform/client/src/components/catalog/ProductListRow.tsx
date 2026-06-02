import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  resolveCatalogVariant,
  selectionFromVariant,
  type CatalogVariant,
  type VariantSelection,
} from "@/lib/catalog-variant-resolve";
import {
  CatalogActionIcons,
  CatalogColorPalette,
  CatalogPhotoBadges,
  CatalogPriceBlock,
  CatalogSpecsButton,
  CatalogStockLine,
  showSpecsButton,
} from "./catalog-card-parts";
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

  const title = product.display_name || product.name;
  const subtitleColor = active.color ?? selection.color ?? null;

  return {
    active,
    selection,
    setSelection,
    showSwitchers,
    variants,
    title,
    subtitleColor,
    groupStock: product.total_stock,
  };
}

export function ProductListRow({ product }: { product: CatalogListProduct }) {
  const { active, selection, setSelection, showSwitchers, variants, title, subtitleColor, groupStock } =
    useVariantDisplay(product);
  const imageSrc = active.image_url || product.image_url || null;
  const detailHref = `/catalog/1c/${active.product_id}`;
  const colors = product.colors ?? [];
  const hasPalette = colors.length > 1;

  return (
    <div
      className="border-b border-border last:border-b-0 hover:bg-muted/30"
      data-testid={`catalog-row-${product.id}`}
    >
      <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:gap-4">
        <Link href={detailHref} className="flex shrink-0">
          <div className="relative h-20 w-20 overflow-hidden rounded-md border border-border/60 bg-white">
            {imageSrc ? (
              <img src={imageSrc} alt={title} className="h-full w-full object-contain p-1" loading="lazy" />
            ) : (
              <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">Нет фото</div>
            )}
            <div className="absolute left-0.5 top-0.5">
              <CatalogPhotoBadges
                product={product}
                priceRetail={active.price_retail}
                priceRetailSale={active.price_retail_sale}
                compact
              />
            </div>
          </div>
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Link href={detailHref} className="line-clamp-2 text-sm font-semibold leading-snug text-foreground hover:underline">
                {title}
              </Link>
              {subtitleColor ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitleColor}</p>
              ) : product.brand ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{product.brand}</p>
              ) : null}
            </div>
            <CatalogPriceBlock
              priceRetail={active.price_retail}
              priceRetailSale={active.price_retail_sale}
              align="right"
              size="sm"
            />
          </div>

          <CatalogStockLine stock={groupStock} />

          {hasPalette ? (
            <CatalogColorPalette
              compact
              colors={colors}
              variants={variants}
              selectedColor={selection.color}
              onSelect={(color) => setSelection({ ...selection, color })}
            />
          ) : null}

          {showSwitchers ? (
            <VariantSwitchers
              compact
              hideColors={hasPalette}
              variants={variants}
              selection={selection}
              onSelectionChange={setSelection}
              sizes={product.sizes ?? []}
              colors={colors}
              doorTypes={product.door_types ?? []}
              sides={product.sides ?? []}
            />
          ) : null}
        </div>
      </div>
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
  const { active, selection, setSelection, showSwitchers, variants, title, subtitleColor, groupStock } =
    useVariantDisplay(product);
  const imageSrc = active.image_url || product.image_url || null;
  const detailHref = `/catalog/1c/${active.product_id}`;
  const colors = product.colors ?? [];
  const hasPalette = colors.length > 1;
  const compact = size === "m" || size === "s";
  const tiny = size === "s";

  const padX = tiny ? "px-2" : compact ? "px-2.5" : "px-3";
  const titleCls = tiny ? "text-xs" : compact ? "text-sm" : "text-base";

  return (
    <article
      className={cn(
        "Card-product flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:shadow-md",
      )}
      data-testid={`catalog-card-${product.id}`}
    >
      <header className={cn("space-y-1.5 pt-3", padX)}>
        <Link href={detailHref} className="block min-w-0">
          <h3 className={cn("Card-product__title-text line-clamp-2 font-semibold leading-snug text-foreground", titleCls)}>
            {title}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {subtitleColor ? <span>{subtitleColor}</span> : null}
            {subtitleColor && product.brand ? <span> · </span> : null}
            {product.brand ? <span>{product.brand}</span> : null}
            {!subtitleColor && !product.brand ? <span className="text-muted-foreground/60">—</span> : null}
          </p>
        </Link>
        <CatalogSpecsButton visible={showSpecsButton(product) && !tiny} compact={compact} />
      </header>

      {hasPalette && !tiny ? (
        <div className={cn(padX, "pt-2")}>
          <CatalogColorPalette
            compact={compact}
            colors={colors}
            variants={variants}
            selectedColor={selection.color}
            onSelect={(color) => setSelection({ ...selection, color })}
          />
        </div>
      ) : null}

      <div className="relative mt-2 aspect-square w-full bg-white">
        <Link href={detailHref} className="block h-full w-full">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={title}
              className={cn("h-full w-full object-contain", tiny ? "p-1" : "p-2")}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Нет фото</div>
          )}
        </Link>
        <div className="pointer-events-none absolute inset-0">
          <div className="pointer-events-auto absolute left-1.5 top-1.5">
            <CatalogPhotoBadges
              product={product}
              priceRetail={active.price_retail}
              priceRetailSale={active.price_retail_sale}
              compact={compact || tiny}
            />
          </div>
          {!tiny ? (
            <div className="pointer-events-auto absolute right-1.5 top-1.5">
              <CatalogActionIcons compact={compact} />
            </div>
          ) : null}
        </div>
      </div>

      {showSwitchers && !tiny ? (
        <div className={cn("border-t border-border/40 pt-2", padX)} onClick={(e) => e.stopPropagation()}>
          <VariantSwitchers
            compact={compact}
            hideColors={hasPalette}
            variants={variants}
            selection={selection}
            onSelectionChange={setSelection}
            sizes={product.sizes ?? []}
            colors={colors}
            doorTypes={product.door_types ?? []}
            sides={product.sides ?? []}
          />
        </div>
      ) : null}

      <footer className={cn("mt-auto space-y-1.5 pb-3 pt-2", padX)}>
        {!tiny ? <CatalogStockLine stock={groupStock} /> : null}
        <CatalogPriceBlock
          priceRetail={active.price_retail}
          priceRetailSale={active.price_retail_sale}
          size={tiny ? "sm" : "md"}
        />
        {tiny ? (
          <div className="flex items-center justify-between gap-1">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                (groupStock ?? 0) > 0 ? "bg-emerald-500" : "bg-muted-foreground/40",
              )}
              title={`В наличии: ${groupStock ?? 0}`}
            />
          </div>
        ) : null}
      </footer>
    </article>
  );
}
