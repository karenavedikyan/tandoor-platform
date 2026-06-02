import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CatalogListProduct = {
  id: string;
  name: string;
  display_name: string | null;
  brand: string | null;
  total_stock: number | null;
  price_retail: number | null;
  price_retail_sale: number | null;
  is_new: boolean;
  is_hit: boolean;
  is_sale: boolean;
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

export function ProductListRow({
  product,
  imageSrc,
}: {
  product: CatalogListProduct;
  imageSrc: string | null;
}) {
  return (
    <Link
      href={`/catalog/1c/${product.id}`}
      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40"
      data-testid={`catalog-row-${product.id}`}
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-white">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={product.name}
            className="h-full w-full object-contain p-1"
            loading="lazy"
          />
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
          <PriceBlock priceRetail={product.price_retail} priceRetailSale={product.price_retail_sale} />
          <Badge variant="secondary" className="text-xs">
            {formatStock(product.total_stock)}
          </Badge>
        </div>
      </div>
    </Link>
  );
}

export function ProductCardGrid({
  product,
  imageSrc,
  size,
}: {
  product: CatalogListProduct;
  imageSrc: string | null;
  size: "xl" | "m" | "s";
}) {
  const titleCls =
    size === "xl" ? "text-base" : size === "m" ? "text-sm" : "text-xs";
  const brandCls =
    size === "xl" ? "text-sm" : size === "m" ? "text-xs" : "hidden";
  const priceCls =
    size === "xl" ? "text-lg" : size === "m" ? "text-base" : "text-sm";
  const pad = size === "s" ? "p-2" : "p-3";
  const imgPad = size === "s" ? "p-1" : "p-2";

  return (
    <Link href={`/catalog/1c/${product.id}`} className="block" data-testid={`catalog-card-${product.id}`}>
      <div className={cn("h-full overflow-hidden rounded-lg border bg-card transition hover:shadow-md")}>
        <div className="relative aspect-square w-full overflow-hidden bg-white">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={product.name}
              className={cn("h-full w-full object-contain", imgPad)}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Фото в 1С отсутствует</div>
          )}
          <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
            <ProductBadges p={product} />
          </div>
        </div>
        <div className={cn("space-y-1", pad)}>
          <div className={cn("line-clamp-2 font-medium", titleCls)} title={product.display_name || product.name}>
            {product.display_name || product.name}
          </div>
          {product.brand && brandCls !== "hidden" ? (
            <div className={cn("truncate text-muted-foreground", brandCls)}>{product.brand}</div>
          ) : null}
          <div className="flex items-end justify-between gap-1">
            <PriceBlock priceRetail={product.price_retail} priceRetailSale={product.price_retail_sale} />
            {size !== "s" ? (
              <Badge variant="secondary" className="shrink-0 text-xs">
                {formatStock(product.total_stock)}
              </Badge>
            ) : (
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  (product.total_stock ?? 0) > 0 ? "bg-emerald-500" : "bg-muted-foreground/40",
                )}
                title={formatStock(product.total_stock)}
              />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
