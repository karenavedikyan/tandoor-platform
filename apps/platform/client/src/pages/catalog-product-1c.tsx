import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Building2, Package, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Stock = {
  warehouse_id: string;
  warehouse_name: string | null;
  qty: number;
  expected_qty: number | null;
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
  properties: { name: string; value: string }[];
  stocks: Stock[];
  categories: { id: string; name: string | null }[];
  prices?: { price_type_id: string; type_name: string; value: number; currency: string }[];
  price_retail?: number | null;
  price_retail_sale?: number | null;
  badges?: { is_new: boolean; is_hit: boolean; is_sale: boolean };
};

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
}

function fmtQty(n: number | null | undefined): string {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("ru-RU");
}

export default function CatalogProduct1cPage() {
  const params = useParams<{ productId: string }>();
  const { toast } = useToast();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);

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
        if (!cancelled) setProduct(data.product);
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

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center gap-2">
        <Link href="/catalog">
          <Button variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Каталог
          </Button>
        </Link>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{product.display_name || product.name}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{product.name}</span>
          {product.brand && <Badge variant="outline">{product.brand}</Badge>}
          {product.badges?.is_new && (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Новинка</Badge>
          )}
          {product.badges?.is_hit && (
            <Badge className="bg-amber-500 text-white hover:bg-amber-500">Хит</Badge>
          )}
          {product.badges?.is_sale && (
            <Badge className="bg-rose-600 text-white hover:bg-rose-600">Акция</Badge>
          )}
          {product.is_on_site && <Badge variant="secondary">На сайте</Badge>}
          {!product.active && <Badge variant="destructive">Неактивный</Badge>}
          {product.group?.name && (
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              {product.group.name}
            </span>
          )}
        </div>
        {(product.price_retail != null || product.price_retail_sale != null) && (
          <div className="pt-1" data-testid="catalog-1c-product-prices">
            {product.price_retail_sale != null ? (
              <>
                <div className="text-2xl font-semibold text-rose-600">{fmtPrice(product.price_retail_sale)}</div>
                {product.price_retail != null ? (
                  <div className="text-sm text-muted-foreground line-through">{fmtPrice(product.price_retail)}</div>
                ) : null}
              </>
            ) : (
              <div className="text-2xl font-semibold">{fmtPrice(product.price_retail)}</div>
            )}
          </div>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted">
              {product.images[activeImg]?.blob_url ? (
                <img
                  src={product.images[activeImg].blob_url!}
                  alt={product.display_name || product.name}
                  className="h-full w-full object-contain"
                />
              ) : product.images[activeImg] ? (
                <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
                  <div>
                    <Package className="mx-auto mb-2 h-6 w-6 opacity-50" />
                    Файл: {product.images[activeImg].path}
                    <div className="mt-1 opacity-70">Фото ещё не загружено в Blob — нажмите «Загрузить фото» в каталоге</div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Изображений нет
                </div>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="flex flex-wrap gap-1">
                {product.images.map((img, i) => (
                  <button
                    key={img.path + i}
                    type="button"
                    onClick={() => setActiveImg(i)}
                    className={
                      "h-12 w-12 overflow-hidden rounded border " +
                      (i === activeImg ? "border-foreground ring-1 ring-foreground" : "border-border")
                    }
                    title={img.path}
                  >
                    {img.blob_url ? (
                      <img src={img.blob_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                        {i + 1}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Синхронизировано: {new Date(product.synced_at).toLocaleString("ru-RU")}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
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
                      <span className="truncate">{s.warehouse_name || s.warehouse_id}</span>
                      <span className="font-medium">{fmtQty(s.qty)}</span>
                      {s.expected_qty != null && s.expected_qty !== 0 && (
                        <Badge variant="outline" className="text-xs">
                          ожид. {fmtQty(s.expected_qty)}
                        </Badge>
                      )}
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

          {product.categories.length > 0 && (
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
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Свойства из 1С</CardTitle>
            </CardHeader>
            <CardContent>
              {product.properties.length === 0 ? (
                <div className="text-sm text-muted-foreground">Свойств нет.</div>
              ) : (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm md:grid-cols-2">
                  {product.properties.map((p, i) => (
                    <div key={p.name + i} className="flex flex-col">
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{p.name}</dt>
                      <dd className="break-words">{p.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
