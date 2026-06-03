import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, Heart, Package, Share2, ShoppingCart, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthUser } from "@/hooks/use-auth-user";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { optimizedImage } from "@/lib/catalog-image";
import { LightboxModal } from "@/components/catalog/LightboxModal";
import {
  groupProperties,
  LONG_VALUE_THRESHOLD,
  looksLikeCode,
  pickShortProperties,
  type GroupedProperty,
} from "../../../shared/catalog-1c/property-filters";

const DESCRIPTION_LONG_THRESHOLD = 280;

type Stock = {
  warehouse_id: string;
  warehouse_name: string | null;
  qty: number;
  expected_qty: number | null;
};

type Breadcrumb = { id: string; name: string; kind: "group" | "category" };

type RelatedProduct = {
  id: string;
  name: string;
  display_name: string | null;
  brand: string | null;
  image_url: string | null;
  price_retail: number | null;
  price_retail_sale: number | null;
  badges: { is_new: boolean; is_hit: boolean; is_sale: boolean };
};

type ProductDetail = {
  id: string;
  name: string;
  display_name: string | null;
  brand: string | null;
  is_on_site: boolean;
  active: boolean;
  synced_at: string;
  group: { id: string; name: string | null } | null;
  images: { path: string; sort_order: number | null; blob_url: string | null }[];
  properties: GroupedProperty[];
  stocks: Stock[];
  categories: { id: string; name: string | null }[];
  price_retail?: number | null;
  price_retail_sale?: number | null;
  badges?: { is_new: boolean; is_hit: boolean; is_sale: boolean };
  breadcrumbs?: Breadcrumb[];
  related?: RelatedProduct[];
  description?: string | null;
};

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
}

function fmtQty(n: number | null | undefined): string {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("ru-RU");
}

function discountPercent(retail: number, sale: number): number | null {
  if (retail <= 0 || sale >= retail) return null;
  return Math.round((1 - sale / retail) * 100);
}

function warehouseDisplayName(s: Stock): string {
  const name = s.warehouse_name?.trim();
  if (name && !looksLikeCode(name)) return name;
  return "Основной склад";
}

function PhotoPlaceholder({ compact }: { compact?: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-[#8f96b0]">
      <Package className={cn("shrink-0", compact ? "h-8 w-8" : "h-12 w-12")} aria-hidden />
      <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>Фото загружается</p>
      <p className={cn(compact ? "text-[10px]" : "text-xs")}>Фото появится после синхронизации</p>
    </div>
  );
}

function CollapsibleValue({
  value,
  collapseThreshold = LONG_VALUE_THRESHOLD,
  collapsedLines = 2,
}: {
  value: string;
  collapseThreshold?: number;
  collapsedLines?: 2 | 4;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = value.length > collapseThreshold;

  if (!isLong) {
    return <span className="whitespace-pre-line">{value}</span>;
  }

  const clampClass = collapsedLines === 4 ? "line-clamp-4" : "line-clamp-2";

  return (
    <div>
      <p className={cn("whitespace-pre-line", !expanded && clampClass)}>{value}</p>
      <button
        type="button"
        className="mt-1 text-sm font-medium text-[#9aca3c] hover:underline"
        onClick={() => setExpanded((open) => !open)}
      >
        {expanded ? "Свернуть" : "Показать полностью"}
      </button>
    </div>
  );
}

function ProductBadgesRow({
  badges,
  small,
}: {
  badges?: { is_new: boolean; is_hit: boolean; is_sale: boolean };
  small?: boolean;
}) {
  const cls = small ? "px-1.5 py-0 text-[10px]" : "";
  return (
    <div className="flex flex-wrap gap-1">
      {badges?.is_new ? (
        <Badge className={cn("bg-[#9aca3c] text-white hover:bg-[#9aca3c]", cls)}>Новинка</Badge>
      ) : null}
      {badges?.is_hit ? (
        <Badge className={cn("bg-[#d84040] text-white hover:bg-[#d84040]", cls)}>Хит</Badge>
      ) : null}
      {badges?.is_sale ? (
        <Badge className={cn("bg-[#d84040] text-white hover:bg-[#d84040]", cls)}>Акция</Badge>
      ) : null}
    </div>
  );
}

function CatalogPriceBlock({
  retail,
  sale,
  large,
}: {
  retail: number | null | undefined;
  sale: number | null | undefined;
  large?: boolean;
}) {
  const pct = retail != null && sale != null ? discountPercent(retail, sale) : null;
  if (sale != null) {
    return (
      <div>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className={cn("font-semibold text-[#d84040]", large ? "text-3xl" : "text-lg")}>
            {fmtPrice(sale)}
          </span>
          {pct != null ? (
            <Badge className="border-transparent bg-[#d84040] text-xs text-white hover:bg-[#d84040]">
              −{pct}%
            </Badge>
          ) : null}
        </div>
        {retail != null ? (
          <div className={cn("text-muted-foreground line-through", large ? "text-base" : "text-sm")}>
            {fmtPrice(retail)}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className={cn("font-semibold text-[#9aca3c]", large ? "text-3xl" : "text-lg")}>
      {fmtPrice(retail)}
    </div>
  );
}

function RelatedCard({ item }: { item: RelatedProduct }) {
  const title = item.display_name || item.name;
  const hasSale = item.price_retail_sale != null;
  const [imageBroken, setImageBroken] = useState(false);
  const relatedImageSrc = optimizedImage(item.image_url, 320);
  const showImage = Boolean(relatedImageSrc) && !imageBroken;

  return (
    <Link href={`/catalog/1c/${item.id}`} className="group block" data-testid={`related-product-${item.id}`}>
      <Card className="h-full overflow-hidden transition hover:shadow-md">
        <div className="relative aspect-square bg-muted">
          {showImage ? (
            <img
              src={relatedImageSrc!}
              alt={title}
              className="h-full w-full object-contain p-1"
              loading="lazy"
              onError={() => setImageBroken(true)}
            />
          ) : (
            <PhotoPlaceholder compact />
          )}
          <div className="absolute left-2 top-2">
            <ProductBadgesRow badges={item.badges} small />
          </div>
        </div>
        <CardContent className="space-y-1 p-3">
          <p className="line-clamp-2 text-sm font-medium leading-snug group-hover:underline">{title}</p>
          {item.brand ? <p className="truncate text-xs text-muted-foreground">{item.brand}</p> : null}
          <div className="text-sm font-semibold">
            {hasSale ? (
              <span className="text-[#d84040]">{fmtPrice(item.price_retail_sale)}</span>
            ) : (
              <span className="text-[#9aca3c]">{fmtPrice(item.price_retail)}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function CatalogProduct1cPage() {
  const params = useParams<{ productId: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuthUser();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  const canGoBackRef = useRef(false);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [brokenImages, setBrokenImages] = useState<Set<number>>(() => new Set());

  const markImageBroken = (index: number) => {
    setBrokenImages((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  useEffect(() => {
    canGoBackRef.current = window.history.length > 1;
  }, []);

  useEffect(() => {
    if (!params.productId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/catalog/product?id=${encodeURIComponent(params.productId)}`, {
          credentials: "include",
        });
        const data = await r.json();
        if (!r.ok || !data.success) {
          throw new Error(data.message || `HTTP ${r.status}`);
        }
        if (!cancelled) {
          setProduct(data.product);
          setActiveImg(0);
          setBrokenImages(new Set());
        }
      } catch (e) {
        if (!cancelled) {
          toast({
            title: "Не удалось загрузить товар",
            description: e instanceof Error ? e.message : String(e),
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.productId, toast]);

  const lightboxImages = useMemo(
    () =>
      (product?.images ?? [])
        .filter((img): img is typeof img & { blob_url: string } => Boolean(img.blob_url?.trim()))
        .map((img) => ({
          path: img.path,
          blob_url: optimizedImage(img.blob_url, 1600, 85) ?? img.blob_url!,
        })),
    [product?.images],
  );

  const activeBlobIdx = useMemo(() => {
    const path = product?.images[activeImg]?.path;
    if (!path) return 0;
    const idx = lightboxImages.findIndex((i) => i.path === path);
    return idx >= 0 ? idx : 0;
  }, [product?.images, activeImg, lightboxImages]);

  const propertyGroups = useMemo(
    () => (product ? groupProperties(product.properties) : []),
    [product],
  );
  const shortProps = useMemo(
    () => (product ? pickShortProperties(product.properties) : []),
    [product],
  );

  const scrollToAllProperties = () => {
    document.getElementById("all-properties")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const shareProduct = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Ссылка скопирована" });
    } catch {
      toast({ title: "Не удалось скопировать ссылку", variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="grid place-items-center py-16 text-sm text-muted-foreground">Загружаю карточку…</div>;
  }
  if (!product) {
    return (
      <div className="grid place-items-center gap-3 py-16 text-sm text-muted-foreground">
        Товар не найден.
        <Link href="/catalog" className="underline">
          Вернуться в каталог
        </Link>
      </div>
    );
  }

  const totalQty = product.stocks.reduce((s, x) => s + (x.qty ?? 0), 0);
  const title = product.display_name || product.name;
  const subtitle =
    product.display_name && product.name.trim() !== product.display_name.trim() ? product.name : null;
  const hasAnyBlob = product.images.some((i) => i.blob_url?.trim());
  const currentImg = product.images[activeImg];
  const mainImageUrl = currentImg?.blob_url?.trim();
  const mainImageSrc = mainImageUrl ? optimizedImage(mainImageUrl, 1080, 80) : null;
  const showMainImage = Boolean(mainImageSrc && !brokenImages.has(activeImg));
  const showLightboxForCurrent = showMainImage;
  const readableBreadcrumbs = (product.breadcrumbs ?? []).filter(
    (b) => b.name?.trim() && !looksLikeCode(b.name),
  );

  const handleBack = () => {
    if (canGoBackRef.current) {
      window.history.back();
    } else {
      setLocation("/catalog");
    }
  };

  return (
    <div className="catalog-font space-y-8 p-4 lg:p-6" data-testid="page-catalog-product-1c">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mb-1 h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
        onClick={handleBack}
        data-testid="catalog-detail-back"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Назад
      </Button>
      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground" aria-label="Хлебные крошки">
        <Link href="/catalog" className="hover:text-foreground hover:underline">
          Каталог
        </Link>
        {readableBreadcrumbs.map((b) => (
          <span key={`${b.kind}-${b.id}`} className="inline-flex items-center gap-1">
            <span aria-hidden>›</span>
            <Link href="/catalog" className="max-w-[200px] truncate hover:text-foreground hover:underline">
              {b.name}
            </Link>
          </span>
        ))}
        <span aria-hidden>›</span>
        <span className="max-w-[240px] truncate font-medium text-foreground">{title}</span>
      </nav>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? <p className="font-mono text-sm text-muted-foreground">{subtitle}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          {product.brand ? <span className="text-sm font-medium text-muted-foreground">{product.brand}</span> : null}
          <ProductBadgesRow badges={product.badges} />
          {product.is_on_site ? <Badge variant="secondary">На сайте</Badge> : null}
          {!product.active ? <Badge variant="destructive">Неактивный</Badge> : null}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Галерея */}
        <div className="space-y-3">
          <button
            type="button"
            className={cn(
              "aspect-square w-full overflow-hidden rounded-xl bg-muted",
              showLightboxForCurrent && "cursor-zoom-in",
            )}
            onClick={() => showLightboxForCurrent && setLightboxOpen(true)}
            disabled={!showLightboxForCurrent}
            aria-label={showLightboxForCurrent ? "Открыть фото на весь экран" : undefined}
          >
            {showMainImage ? (
              <img
                src={mainImageSrc!}
                alt={title}
                className="h-full w-full object-contain p-2"
                onError={() => markImageBroken(activeImg)}
              />
            ) : (
              <PhotoPlaceholder />
            )}
          </button>

          {product.images.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:thin]">
              {product.images.map((img, i) => {
                const thumbSrc = img.blob_url?.trim() ? optimizedImage(img.blob_url, 96) : null;
                return (
                <button
                  key={img.path + i}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  className={cn(
                    "h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-muted transition",
                    i === activeImg ? "border-primary" : "border-transparent opacity-80 hover:opacity-100",
                  )}
                  title={img.path}
                >
                  {thumbSrc && !brokenImages.has(i) ? (
                    <img
                      src={thumbSrc}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={() => markImageBroken(i)}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[#8f96b0]">
                      {img.blob_url?.trim() && brokenImages.has(i) ? (
                        <Package className="h-4 w-4" aria-hidden />
                      ) : (
                        <span className="text-[10px]">{i + 1}</span>
                      )}
                    </span>
                  )}
                </button>
                );
              })}
            </div>
          ) : null}

          <LightboxModal
            open={lightboxOpen}
            onOpenChange={setLightboxOpen}
            images={lightboxImages}
            activeIdx={activeBlobIdx}
            onActiveIdxChange={(idx) => {
              const path = lightboxImages[idx]?.path;
              if (!path) return;
              const orig = product.images.findIndex((im) => im.path === path);
              if (orig >= 0) setActiveImg(orig);
            }}
            alt={title}
          />
        </div>

        {/* Правая колонка */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Цена и наличие</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Розничная цена</p>
                <CatalogPriceBlock
                  retail={product.price_retail}
                  sale={product.price_retail_sale}
                  large
                />
                <p className="mt-1 text-xs text-muted-foreground">за единицу</p>
              </div>

              {totalQty > 0 ? (
                <div className="rounded-lg border border-[#9aca3c]/40 bg-[#9aca3c]/10 px-3 py-2 text-sm font-medium text-foreground">
                  В наличии: {fmtQty(totalQty)} шт.
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  Под заказ
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-md border border-border">
                    <button
                      type="button"
                      className="grid h-9 w-9 place-items-center text-lg hover:text-[#9aca3c]"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      aria-label="Уменьшить количество"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-sm font-medium tabular-nums">{qty}</span>
                    <button
                      type="button"
                      className="grid h-9 w-9 place-items-center text-lg hover:text-[#9aca3c]"
                      onClick={() => setQty((q) => q + 1)}
                      aria-label="Увеличить количество"
                    >
                      +
                    </button>
                  </div>
                  <Button
                    type="button"
                    className="h-9 flex-1 gap-2 bg-[#9aca3c] text-white hover:bg-[#9aca3c]/90"
                    onClick={() =>
                      toast({ title: "Корзина появится в следующем релизе" })
                    }
                  >
                    <ShoppingCart className="h-4 w-4" />
                    В корзину
                  </Button>
                </div>
                <Button type="button" variant="outline" className="w-full gap-2">
                  <Heart className="h-4 w-4" />
                  В избранное
                </Button>
                <Button type="button" variant="outline" className="w-full gap-2" onClick={() => void shareProduct()}>
                  <Share2 className="h-4 w-4" />
                  Поделиться
                </Button>
              </div>
            </CardContent>
          </Card>

          {shortProps.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Краткие характеристики</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="space-y-2 text-sm">
                  {shortProps.map((p) => (
                    <div key={p.name} className="flex justify-between gap-4 border-b border-border/60 pb-2 last:border-0">
                      <dt className="text-muted-foreground">{p.name}</dt>
                      <dd className="text-right font-medium">{p.value}</dd>
                    </div>
                  ))}
                </dl>
                <button
                  type="button"
                  className="text-sm font-medium text-[#9aca3c] hover:underline"
                  onClick={scrollToAllProperties}
                >
                  Все характеристики →
                </button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {product.description ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Описание</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-relaxed text-foreground">
            <CollapsibleValue
              value={product.description}
              collapseThreshold={DESCRIPTION_LONG_THRESHOLD}
              collapsedLines={4}
            />
          </CardContent>
        </Card>
      ) : null}

      {propertyGroups.length > 0 ? (
        <Card id="all-properties">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Все характеристики</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {propertyGroups.map((g) => (
              <section key={g.title}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h3>
                <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                  {g.properties.map((p) => {
                    const isLong = p.value.length > LONG_VALUE_THRESHOLD;
                    return (
                      <div
                        key={p.name}
                        className={cn(
                          "border-b border-border/40 py-1.5 text-sm",
                          isLong
                            ? "flex flex-col gap-1 sm:col-span-2"
                            : "grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2",
                        )}
                      >
                        <dt className="text-muted-foreground">{p.name}</dt>
                        <dd className="break-words font-medium">
                          <CollapsibleValue value={p.value} />
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Остатки по складам</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {product.stocks.length === 0 ? (
            <div className="text-sm text-muted-foreground">Остатков нет.</div>
          ) : (
            <div className="space-y-1.5">
              {product.stocks.map((s) => (
                <div key={s.warehouse_id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{warehouseDisplayName(s)}</span>
                  <span className="font-medium">{fmtQty(s.qty)}</span>
                  {s.expected_qty != null && s.expected_qty !== 0 ? (
                    <Badge variant="outline" className="text-xs">
                      ожид. {fmtQty(s.expected_qty)}
                    </Badge>
                  ) : null}
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
                <span>Итого</span>
                <span>{fmtQty(totalQty)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {product.categories.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Разделы</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {product.categories.map((c) => (
              <Badge key={c.id} variant="outline" className="text-xs">
                <Tag className="mr-1 h-3 w-3" />
                {c.name || c.id}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {(product.related?.length ?? 0) > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Похожие товары</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {product.related!.map((r) => (
              <RelatedCard key={r.id} item={r} />
            ))}
          </div>
        </section>
      ) : null}

      {isAdmin && !hasAnyBlob && product.images.length > 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          Синхронизировано: {new Date(product.synced_at).toLocaleString("ru-RU")}
        </p>
      ) : null}
    </div>
  );
}
