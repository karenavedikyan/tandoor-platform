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
  CatalogInlineBadges,
  CatalogInlinePrice,
  CatalogPhotoBadges,
  CatalogPriceBlock,
  CatalogSpecsButton,
  CatalogStockLine,
  formatCatalogStock,
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

function ListRowThumbPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <DoorOpen className="h-4 w-4 shrink-0 text-muted-foreground opacity-50" aria-hidden />
    </div>
  );
}

const listHeaderLabel =
  "text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

/** Column header for document-style list rows — widths match `ProductListRow`. */
export function ProductListHeader() {
  return (
    <div
      className="bg-muted/40"
      role="row"
      data-testid="catalog-list-header"
    >
      <div className="flex items-center gap-2 px-3 py-1.5 min-[650px]:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 min-[650px]:gap-3">
          <span className="w-8 shrink-0" aria-hidden />
          <span className={listHeaderLabel}>Товар</span>
        </div>
        <span className="hidden w-20 shrink-0 min-[650px]:block" aria-hidden />
        <span className={cn(listHeaderLabel, "hidden w-16 shrink-0 text-right min-[650px]:block")}>
          Остаток
        </span>
        <span
          className={cn(
            listHeaderLabel,
            "w-[5.5rem] shrink-0 text-right min-[650px]:w-28",
          )}
        >
          Цена
        </span>
        <span className="w-[4.25rem] shrink-0 min-[650px]:w-[4.5rem]" aria-hidden />
      </div>
    </div>
  );
}

export function ProductListRow({ product }: { product: CatalogListProduct }) {
  const { active, title, subtitleColor, groupStock } = useVariantDisplay(product);
  const imageSrc = optimizedImage(active.image_url || product.image_url, 96);
  const [imgFailed, setImgFailed] = useState(false);
  const detailHref = `/catalog/1c/${active.product_id}`;
  const showImage = Boolean(imageSrc) && !imgFailed;
  const subtitle = subtitleColor || product.brand;
  const titleLine = subtitle ? `${title} · ${subtitle}` : title;
  const variantHint =
    (product.variant_count ?? 0) > 1 ? product.variant_count : (product.variants?.length ?? 0) > 1 ? product.variants!.length : 0;
  const stock = groupStock ?? 0;

  useEffect(() => {
    setImgFailed(false);
  }, [product.id, imageSrc]);

  return (
    <div
      className="Card-product-aflat border-b border-border last:border-b-0 hover:bg-muted/30"
      data-testid={`catalog-row-${product.id}`}
    >
      <div className="flex items-center gap-2 px-3 py-2 min-[650px]:gap-3">
        <Link
          href={detailHref}
          className="group flex min-w-0 flex-1 items-center gap-2 min-[650px]:gap-3 hover:underline"
        >
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded border border-border bg-card">
            {showImage ? (
              <img
                src={imageSrc!}
                alt=""
                className="h-full w-full object-contain p-0.5"
                loading="lazy"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <ListRowThumbPlaceholder />
            )}
          </div>
          <span className="min-w-0 truncate text-sm font-medium text-foreground group-hover:text-[#9aca3c] hover:text-[#9aca3c]">
            {titleLine}
            {variantHint > 1 ? (
              <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">+{variantHint}</span>
            ) : null}
          </span>
        </Link>

        <div className="hidden w-20 shrink-0 min-[650px]:block">
          <CatalogInlineBadges
            product={product}
            priceRetail={active.price_retail}
            priceRetailSale={active.price_retail_sale}
          />
        </div>

        <span
          className={cn(
            "hidden w-16 shrink-0 text-right text-xs tabular-nums min-[650px]:block",
            stock > 0 ? "text-foreground" : "text-muted-foreground",
          )}
          title={stock > 0 ? `В наличии: ${formatCatalogStock(stock)}` : "Нет в наличии"}
        >
          {stock > 0 ? `${formatCatalogStock(stock)}` : "—"}
        </span>

        <div className="w-[5.5rem] shrink-0 text-right min-[650px]:w-28">
          <CatalogInlinePrice
            priceRetail={active.price_retail}
            priceRetailSale={active.price_retail_sale}
          />
        </div>

        <div
          className="relative z-10 w-[4.25rem] shrink-0 min-[650px]:w-[4.5rem]"
          onClick={(e) => e.stopPropagation()}
        >
          <CatalogCardActionsRow compact layout="list" density="compact" />
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

      <div
        className={cn(
          "Card-product__block-img relative mt-2 w-full overflow-hidden bg-white aspect-square",
          size === "xl" ? "max-h-[320px]" : size === "m" ? "max-h-[220px]" : "max-h-[150px]",
        )}
      >
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
