import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { LayoutGrid, List, RefreshCw, Search, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuthUser } from "@/hooks/use-auth-user";

type ViewMode = "cards" | "list" | "table";

type CatalogProductItem = {
  id: string;
  name: string;
  display_name: string | null;
  brand: string | null;
  is_on_site: boolean;
  image_path: string | null;
  image_url: string | null;
  total_stock: number | null;
  price_retail: number | null;
  price_retail_sale: number | null;
  is_new: boolean;
  is_hit: boolean;
  is_sale: boolean;
};

type CategoryItem = {
  id: string;
  name: string;
  parent_id: string | null;
  product_count: number;
};

type SyncLogRow = {
  id: string;
  source_file: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  rows_upserted: number;
  duration_ms: number | null;
  error: string | null;
};

const PAGE_SIZE = 50;

function formatStock(n: number | null): string {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("ru-RU");
}

function formatPrice(n: number | null): string {
  if (n == null) return "—";
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
}

function CatalogPriceBlock({
  priceRetail,
  priceRetailSale,
  className,
}: {
  priceRetail: number | null;
  priceRetailSale: number | null;
  className?: string;
}) {
  if (priceRetailSale != null) {
    return (
      <div className={className}>
        <div className="font-semibold text-rose-600">{formatPrice(priceRetailSale)}</div>
        {priceRetail != null ? (
          <div className="text-xs text-muted-foreground line-through">{formatPrice(priceRetail)}</div>
        ) : null}
      </div>
    );
  }
  return <div className={cn("font-semibold", className)}>{formatPrice(priceRetail)}</div>;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function CatalogPage() {
  const { user } = useAuthUser();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const [view, setView] = useState<ViewMode>("cards");
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [sort, setSort] = useState<"name" | "stock" | "price_asc" | "price_desc">("name");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  const [onlyHit, setOnlyHit] = useState(false);
  const [onlySale, setOnlySale] = useState(false);
  const [items, setItems] = useState<CatalogProductItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [lastSync, setLastSync] = useState<SyncLogRow | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingPhotos, setSyncingPhotos] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  async function loadProducts(nextOffset: number, append = false) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (categoryId && categoryId !== "all") params.set("category_id", categoryId);
      if (sort !== "name") params.set("sort", sort);
      if (onlyInStock) params.set("in_stock", "1");
      if (onlyNew) params.set("is_new", "1");
      if (onlyHit) params.set("is_hit", "1");
      if (onlySale) params.set("is_sale", "1");
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(nextOffset));
      const r = await fetch(`/api/catalog/products?${params}`, { signal: ac.signal, credentials: "include" });
      const data = await r.json();
      if (!r.ok || !data.success) {
        throw new Error(data.message || `HTTP ${r.status}`);
      }
      setTotal(data.total ?? 0);
      setOffset(nextOffset);
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      toast({
        title: "Не удалось загрузить каталог",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const r = await fetch(`/api/catalog/categories`, { credentials: "include" });
      const data = await r.json();
      if (r.ok && data.success) {
        setCategories(data.items ?? []);
      }
    } catch {
      /* tolerable */
    }
  }

  async function loadLastSync() {
    if (!isAdmin) return;
    try {
      const r = await fetch(`/api/admin/catalog-1c-sync-log?limit=1`, { credentials: "include" });
      const data = await r.json();
      if (r.ok && data.success && data.logs?.[0]) {
        setLastSync(data.logs[0]);
      }
    } catch {
      /* tolerable */
    }
  }

  async function triggerSync() {
    setSyncing(true);
    try {
      const r = await fetch(`/api/admin/sync-catalog-1c`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "both" }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        throw new Error(data.message || `HTTP ${r.status}`);
      }
      toast({
        title: "Импорт каталога запущен",
        description: "Идёт загрузка с FTP 1С — обновите через 1–3 минуты.",
      });
      // poll status каждые 5с в течение 3 минут
      let tries = 0;
      const iv = setInterval(async () => {
        tries += 1;
        await loadLastSync();
        if (tries >= 36) clearInterval(iv);
      }, 5000);
    } catch (e) {
      toast({
        title: "Не удалось запустить импорт",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function triggerPhotoSync() {
    setSyncingPhotos(true);
    try {
      const r = await fetch(`/api/admin/sync-catalog-1c-photos`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "both", limit: 500 }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        throw new Error(data.message || `HTTP ${r.status}`);
      }
      toast({
        title: "Синк фото запущен",
        description: "До 500 фото за запуск. Обновите страницу через 2–5 минут.",
      });
    } catch (e) {
      toast({
        title: "Не удалось запустить синк фото",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSyncingPhotos(false);
    }
  }

  useEffect(() => {
    void loadCategories();
    void loadLastSync();
    // initial products load
    void loadProducts(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadProducts(0, false);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, categoryId, sort, onlyInStock, onlyNew, onlyHit, onlySale]);

  const topCategories = useMemo(
    () => categories.filter((c) => c.parent_id == null && c.product_count > 0),
    [categories],
  );

  function imageSrc(p: CatalogProductItem): string | null {
    // Vercel Blob если уже залит, иначе пока null (заливка идёт пачками на VM).
    return p.image_url || null;
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Каталог</h1>
          <p className="text-sm text-muted-foreground">
            Товары из 1С • {total.toLocaleString("ru-RU")} активных позиций
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            {lastSync && (
              <div className="text-xs text-muted-foreground">
                Последняя синхронизация:{" "}
                <Badge
                  variant={lastSync.status === "ok" ? "secondary" : lastSync.status === "running" ? "default" : "destructive"}
                  className="ml-1"
                >
                  {lastSync.status === "ok"
                    ? "успешно"
                    : lastSync.status === "running"
                      ? "идёт"
                      : "ошибка"}
                </Badge>
                <span className="ml-2">
                  {formatDateTime(lastSync.finished_at ?? lastSync.started_at)}
                </span>
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => void triggerSync()}
              disabled={syncing || lastSync?.status === "running"}
              data-testid="catalog-sync-button"
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", syncing && "animate-spin")} />
              Обновить из 1С
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void triggerPhotoSync()}
              disabled={syncingPhotos}
              data-testid="catalog-sync-photos-button"
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", syncingPhotos && "animate-spin")} />
              Загрузить фото
            </Button>
          </div>
        )}
      </header>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_240px_auto]">
          <div className="space-y-1">
            <Label htmlFor="catalog-search" className="text-xs">
              Поиск
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="catalog-search"
                placeholder="Название, отображение, артикул…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
                data-testid="catalog-search-input"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Раздел</Label>
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v)}>
              <SelectTrigger data-testid="catalog-category-select">
                <SelectValue placeholder="Все разделы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все разделы</SelectItem>
                {topCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} • {c.product_count}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-full flex flex-wrap items-center gap-2 pt-1">
            <Label className="text-xs text-muted-foreground">Быстрые фильтры:</Label>
            <FilterChip active={onlyInStock} onClick={() => setOnlyInStock((v) => !v)}>В наличии</FilterChip>
            <FilterChip active={onlyNew} onClick={() => setOnlyNew((v) => !v)}>Новинки</FilterChip>
            <FilterChip active={onlyHit} onClick={() => setOnlyHit((v) => !v)}>Хит</FilterChip>
            <FilterChip active={onlySale} onClick={() => setOnlySale((v) => !v)}>Акции</FilterChip>
            <div className="ml-auto flex items-center gap-1">
              <Label className="text-xs text-muted-foreground">Сортировка:</Label>
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">По названию</SelectItem>
                  <SelectItem value="price_asc">Цена ↑</SelectItem>
                  <SelectItem value="price_desc">Цена ↓</SelectItem>
                  <SelectItem value="stock">По остатку</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-end gap-1">
            <Button
              size="icon"
              variant={view === "cards" ? "default" : "outline"}
              onClick={() => setView("cards")}
              title="Карточки"
              aria-label="Карточки"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={view === "list" ? "default" : "outline"}
              onClick={() => setView("list")}
              title="Список"
              aria-label="Список"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={view === "table" ? "default" : "outline"}
              onClick={() => setView("table")}
              title="Таблица"
              aria-label="Таблица"
            >
              <Table2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && items.length === 0 ? (
        <div className="grid place-items-center py-16 text-sm text-muted-foreground">
          Загружаю каталог…
        </div>
      ) : items.length === 0 ? (
        <div className="grid place-items-center py-16 text-sm text-muted-foreground">
          Ничего не найдено. Уточните запрос.
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} imageSrc={imageSrc(p)} />
          ))}
        </div>
      ) : view === "list" ? (
        <Card>
          <CardContent className="divide-y p-0">
            {items.map((p) => (
              <Link
                key={p.id}
                href={`/catalog/1c/${p.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40"
                data-testid={`catalog-row-${p.id}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate font-medium">{p.display_name || p.name}</div>
                    <ProductBadges p={p} small />
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{p.name}</div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <CatalogPriceBlock
                    className="text-right text-sm"
                    priceRetail={p.price_retail}
                    priceRetailSale={p.price_retail_sale}
                  />
                  <Badge variant="secondary">{formatStock(p.total_stock)}</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Отображение</th>
                    <th className="px-3 py-2">Артикул 1С</th>
                    <th className="px-3 py-2">Бренд</th>
                    <th className="px-3 py-2 text-right">РРЦ</th>
                    <th className="px-3 py-2 text-right">Остаток</th>
                    <th className="px-3 py-2">Сайт</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <Link href={`/catalog/1c/${p.id}`} className="font-medium underline-offset-2 hover:underline">
                          {p.display_name || p.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{p.name}</td>
                      <td className="px-3 py-2 text-xs">{p.brand ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        <CatalogPriceBlock priceRetail={p.price_retail} priceRetailSale={p.price_retail_sale} />
                      </td>
                      <td className="px-3 py-2 text-right">{formatStock(p.total_stock)}</td>
                      <td className="px-3 py-2">
                        {p.is_on_site ? (
                          <Badge variant="secondary">Да</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length < total && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => void loadProducts(offset + PAGE_SIZE, true)}
            disabled={loading}
            data-testid="catalog-load-more"
          >
            {loading ? "Загружаю…" : `Показать ещё (${total - items.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function ProductBadges({ p, small }: { p: CatalogProductItem; small?: boolean }) {
  const cls = small ? "px-1.5 py-0 text-[10px]" : "";
  return (
    <>
      {p.is_new && <Badge className={cn("bg-emerald-600 text-white hover:bg-emerald-600", cls)}>New</Badge>}
      {p.is_hit && <Badge className={cn("bg-amber-500 text-white hover:bg-amber-500", cls)}>Hit</Badge>}
      {p.is_sale && <Badge className={cn("bg-rose-600 text-white hover:bg-rose-600", cls)}>Sale</Badge>}
    </>
  );
}

function ProductCard({ product, imageSrc }: { product: CatalogProductItem; imageSrc: string | null }) {
  return (
    <Link
      href={`/catalog/1c/${product.id}`}
      className="block"
      data-testid={`catalog-card-${product.id}`}
    >
      <Card className="h-full transition hover:shadow-md">
        <div className="relative aspect-square w-full overflow-hidden rounded-t-lg bg-muted">
          {imageSrc ? (
            <img src={imageSrc} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Фото в 1С отсутствует
            </div>
          )}
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            <ProductBadges p={product} />
          </div>
        </div>
        <CardContent className="space-y-1 p-3">
          <div className="line-clamp-2 text-sm font-medium" title={product.display_name || product.name}>
            {product.display_name || product.name}
          </div>
          {product.brand && <div className="truncate text-xs text-muted-foreground">{product.brand}</div>}
          <div className="flex items-end justify-between gap-2">
            <CatalogPriceBlock
              className="min-w-0"
              priceRetail={product.price_retail}
              priceRetailSale={product.price_retail_sale}
            />
            <Badge variant="secondary">{formatStock(product.total_stock)}</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
