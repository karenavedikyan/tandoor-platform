import { useEffect, useMemo, useState } from "react";
import { DoorOpen } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  resolveCatalogVariant,
  selectionFromVariant,
  type CatalogVariant,
  type VariantSelection,
} from "@/lib/catalog-variant-resolve";
import {
  CatalogCardActionsRow,
  CatalogColorPalette,
  CatalogPhotoBadges,
  CatalogPriceBlock,
  CatalogSpecsButton,
  CatalogStockLine,
  showSpecsButton,
} from "./catalog-card-parts";
import { optimizedImage } from "@/lib/catalog-image";
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

function ListRowPhotoPlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
      <DoorOpen className="h-6 w-6 shrink-0 opacity-60" aria-hidden />
      <span className="text-[10px] leading-none">Нет фото</span>
    </div>
  );
}

export function ProductListRow({ product }: { product: CatalogListProduct }) {
  const { active, selection, setSelection, showSwitchers, variants, title, subtitleColor, groupStock } =
    useVariantDisplay(product);
  const imageSrc = optimizedImage(active.image_url || product.image_url, 240);
  const [imgFailed, setImgFailed] = useState(false);
  const detailHref = `/catalog/1c/${active.product_id}`;
  const colors = product.colors ?? [];
  const hasPalette = colors.length > 1;
  const showImage = Boolean(imageSrc) && !imgFailed;

  useEffect(() => {
    setImgFailed(false);
  }, [product.id, imageSrc]);

  return (
    <div
      className="Card-product-aflat border-b border-border last:border-b-0 hover:bg-muted/20"
      data-testid={`catalog-row-${product.id}`}
    >
      <div className="flex flex-col gap-3 px-3 py-3 min-[650px]:flex-row min-[650px]:items-start min-[650px]:gap-4 min-[650px]:px-4">
        <Link href={detailHref} className="shrink-0">
          <div className="relative h-24 w-24 overflow-hidden rounded-md border border-border bg-card min-[650px]:h-28 min-[650px]:w-28">
            {showImage ? (
              <img
                src={imageSrc!}
                alt=""
                className="h-full w-full object-contain p-1.5"
                loading="lazy"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <ListRowPhotoPlaceholder />
            )}
            <div className="pointer-events-none absolute left-1 top-1">
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
          <Link
            href={detailHref}
            className="line-clamp-2 text-sm font-semibold leading-snug text-foreground hover:underline"
          >
            {title}
          </Link>
          {subtitleColor ? (
            <p className="truncate text-xs text-muted-foreground">{subtitleColor}</p>
          ) : product.brand ? (
            <p className="truncate text-xs text-muted-foreground">{product.brand}</p>
          ) : null}
          {subtitleColor && product.brand ? (
            <p className="truncate text-xs text-muted-foreground">{product.brand}</p>
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

          {hasPalette ? (
            <CatalogColorPalette
              compact
              colors={colors}
              variants={variants}
              selectedColor={selection.color}
              onSelect={(color) => setSelection({ ...selection, color })}
            />
          ) : null}

          <CatalogStockLine stock={groupStock} />
        </div>

        <div className="flex shrink-0 flex-row items-center justify-between gap-4 border-t border-border/40 pt-2 min-[650px]:w-44 min-[650px]:flex-col min-[650px]:items-end min-[650px]:border-t-0 min-[650px]:pt-0">
          <CatalogPriceBlock
            priceRetail={active.price_retail}
            priceRetailSale={active.price_retail_sale}
            align="right"
            size="sm"
          />
          <CatalogCardActionsRow compact layout="list" />
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
  const previewWidth = size === "xl" ? 640 : size === "m" ? 320 : 200;
  const imageSrc = optimizedImage(active.image_url || product.image_url, previewWidth);
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
        "Card-product flex h-full flex-col justify-between overflow-hidden rounded-[15px] border border-border/80 bg-card shadow-[0_5px_15px_rgba(143,150,176,0.3)] transition hover:shadow-[0_8px_24px_rgba(143,150,176,0.4)]",
        size === "xl" && "min-h-[450px]",
      )}
      data-testid={`catalog-card-${product.id}`}
    >
      <header className={cn("Card-product__header space-y-1.5 pt-3 text-center", padX)}>
        <Link href={detailHref} className="block min-w-0">
          <h3 className={cn("Card-product__title-text line-clamp-2 font-semibold leading-snug text-foreground", titleCls)}>
            {title}
          </h3>
          {subtitleColor ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{subtitleColor}</p>
          ) : null}
          {product.brand ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{product.brand}</p>
          ) : null}
        </Link>
        <div className="flex justify-center">
          <CatalogSpecsButton visible={showSpecsButton(product) && !tiny} compact={compact} />
        </div>
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

      <div className="Card-product__block-img relative mt-2 aspect-square w-full overflow-hidden bg-white">
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

      <footer className={cn("mt-auto space-y-2 pb-3 pt-1", padX)}>
        {!tiny ? <CatalogStockLine stock={groupStock} className="px-0.5" /> : null}
        <CatalogPriceBlock
          priceRetail={active.price_retail}
          priceRetailSale={active.price_retail_sale}
          size={tiny ? "sm" : "md"}
        />
        {!tiny ? <CatalogCardActionsRow compact={compact} /> : null}
        {tiny ? (
          <div className="flex items-center justify-between gap-1">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                (groupStock ?? 0) > 0 ? "bg-[#9aca3c]" : "bg-muted-foreground/40",
              )}
              title={`В наличии: ${groupStock ?? 0}`}
            />
          </div>
        ) : null}
      </footer>
    </article>
  );
}
