import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Grid2x2, Grid3x3, LayoutGrid, List, RefreshCw, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuthUser } from "@/hooks/use-auth-user";
import { FilterCheckboxGroup } from "@/components/catalog/FilterCheckboxGroup";
import {
  ProductCardGrid,
  ProductListRow,
  type CatalogListProduct,
} from "@/components/catalog/ProductListRow";

type CardSize = "xl" | "m" | "s" | "list";

type CatalogProductItem = CatalogListProduct & {
  is_on_site: boolean;
  image_path: string | null;
  image_url: string | null;
};

type CategoryItem = {
  id: string;
  name: string;
  parent_id: string | null;
  product_count: number;
};

type FilterGroupKind = "checkbox" | "range_buckets" | "boolean";

type FiltersResponse = {
  success: boolean;
  categoryTitle: string | null;
  rootCategoryId: string | null;
  price: { min: number | null; max: number | null };
  groups: Array<{
    key: string;
    label: string;
    kind: FilterGroupKind;
    order: number;
    values: Array<{ value: string; count: number }>;
  }>;
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
const CARD_SIZE_KEY = "catalog-card-size";

function readCardSize(): CardSize {
  const v = localStorage.getItem(CARD_SIZE_KEY);
  if (v === "xl" || v === "m" || v === "s" || v === "list") return v;
  return "m";
}

function encodePropsParam(propFilters: Record<string, string[]>): string {
  const pairs: string[] = [];
  for (const [k, vals] of Object.entries(propFilters)) {
    for (const v of vals) {
      pairs.push(`${encodeURIComponent(k)}:${encodeURIComponent(v)}`);
    }
  }
  return pairs.join(",");
}

function formatStock(n: number | null): string {
  if (n == null) return "—";
  return Math.round(n).toLocaleString("ru-RU");
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

  const [cardSize, setCardSize] = useState<CardSize>(readCardSize);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [sort, setSort] = useState<"default" | "name" | "stock" | "price_asc" | "price_desc">("default");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  const [onlyHit, setOnlyHit] = useState(false);
  const [onlySale, setOnlySale] = useState(false);

  const [pendingPropFilters, setPendingPropFilters] = useState<Record<string, string[]>>({});
  const [appliedPropFilters, setAppliedPropFilters] = useState<Record<string, string[]>>({});
  const [pendingPriceRange, setPendingPriceRange] = useState<[number, number] | null>(null);
  const [appliedPriceRange, setAppliedPriceRange] = useState<[number, number] | null>(null);
  const [priceBounds, setPriceBounds] = useState<[number, number]>([0, 0]);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

  const [items, setItems] = useState<CatalogProductItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [lastSync, setLastSync] = useState<SyncLogRow | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncingPhotos, setSyncingPhotos] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    localStorage.setItem(CARD_SIZE_KEY, cardSize);
  }, [cardSize]);

  useEffect(() => {
    setPendingPropFilters({});
    setAppliedPropFilters({});
    setPendingPriceRange(null);
    setAppliedPriceRange(null);
  }, [categoryId]);

  const filtersQuery = useQuery({
    queryKey: ["catalog-filters", categoryId],
    queryFn: async (): Promise<FiltersResponse> => {
      const qs =
        categoryId !== "all" ? `?category_id=${encodeURIComponent(categoryId)}` : "";
      const r = await fetch(`/api/catalog/filters${qs}`, { credentials: "include" });
      const data = await r.json();
      if (!r.ok || !data.success) {
        throw new Error(data.message || `HTTP ${r.status}`);
      }
      return data;
    },
  });

  useEffect(() => {
    const p = filtersQuery.data?.price;
    if (p?.min == null || p?.max == null) return;
    setPriceBounds([p.min, p.max]);
    setPendingPriceRange([p.min, p.max]);
    setAppliedPriceRange([p.min, p.max]);
  }, [filtersQuery.data, categoryId]);

  const priceFilterActive = useMemo(() => {
    if (!appliedPriceRange) return false;
    const [lo, hi] = appliedPriceRange;
    const [bLo, bHi] = priceBounds;
    if (bHi <= bLo) return false;
    return lo > bLo || hi < bHi;
  }, [appliedPriceRange, priceBounds]);

  const hasAdvancedFilters =
    Object.values(appliedPropFilters).some((v) => v.length > 0) || priceFilterActive;

  const hasPendingChanges = useMemo(() => {
    const priceChanged =
      JSON.stringify(pendingPriceRange) !== JSON.stringify(appliedPriceRange);
    const propsChanged = JSON.stringify(pendingPropFilters) !== JSON.stringify(appliedPropFilters);
    return priceChanged || propsChanged;
  }, [pendingPropFilters, appliedPropFilters, pendingPriceRange, appliedPriceRange]);

  const productsQueryKey = useMemo(
    () => [
      "catalog-products",
      query,
      categoryId,
      sort,
      onlyInStock,
      onlyNew,
      onlyHit,
      onlySale,
      appliedPropFilters,
      appliedPriceRange,
      priceFilterActive,
    ],
    [
      query,
      categoryId,
      sort,
      onlyInStock,
      onlyNew,
      onlyHit,
      onlySale,
      appliedPropFilters,
      appliedPriceRange,
      priceFilterActive,
    ],
  );

  async function loadProducts(nextOffset: number, append = false) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (categoryId && categoryId !== "all") params.set("category_id", categoryId);
      if (sort !== "default") params.set("sort", sort);
      if (onlyInStock) params.set("in_stock", "1");
      if (onlyNew) params.set("is_new", "1");
      if (onlyHit) params.set("is_hit", "1");
      if (onlySale) params.set("is_sale", "1");
      const propsEnc = encodePropsParam(appliedPropFilters);
      if (propsEnc) params.set("props", propsEnc);
      if (priceFilterActive && appliedPriceRange) {
        params.set("price_min", String(Math.round(appliedPriceRange[0])));
        params.set("price_max", String(Math.round(appliedPriceRange[1])));
      }
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

  function resetAdvancedFilters() {
    setPendingPropFilters({});
    setAppliedPropFilters({});
    const p = filtersQuery.data?.price;
    if (p?.min != null && p?.max != null) {
      setPendingPriceRange([p.min, p.max]);
      setAppliedPriceRange([p.min, p.max]);
    } else {
      setPendingPriceRange(null);
      setAppliedPriceRange(null);
    }
  }

  function applyAdvancedFilters() {
    setAppliedPropFilters({ ...pendingPropFilters });
    setAppliedPriceRange(pendingPriceRange ? [...pendingPriceRange] : null);
    setFiltersSheetOpen(false);
  }

  useEffect(() => {
    void loadCategories();
    void loadLastSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadProducts(0, false);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, productsQueryKey);

  const topCategories = useMemo(
    () => categories.filter((c) => c.parent_id == null && c.product_count > 0),
    [categories],
  );

  const gridCls = {
    xl: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3",
    m: "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
    s: "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8",
  }[cardSize === "list" ? "m" : cardSize];

  const filterPanelTitle =
    filtersQuery.data?.categoryTitle ??
    (categoryId !== "all"
      ? topCategories.find((c) => c.id === categoryId)?.name
      : null) ??
    "Все разделы";

  const advancedFiltersPanel = (
    <CatalogAdvancedFilters
      title={filterPanelTitle}
      filtersData={filtersQuery.data}
      filtersLoading={filtersQuery.isLoading}
      propFilters={pendingPropFilters}
      setPropFilters={setPendingPropFilters}
      priceRange={pendingPriceRange}
      priceBounds={priceBounds}
      onPriceChange={setPendingPriceRange}
      onReset={resetAdvancedFilters}
      onApply={applyAdvancedFilters}
      hasPendingChanges={hasPendingChanges}
    />
  );

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
                placeholder="Название, бренд, цвет, коллекция…"
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

          <div className="flex flex-col items-stretch gap-2">
            <Sheet open={filtersSheetOpen} onOpenChange={setFiltersSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  className="relative w-full gap-2 bg-[#9aca3c] text-white hover:bg-[#86b832]"
                  aria-label="Подобрать по Фильтрам"
                  data-testid="catalog-filters-open"
                >
                  <SlidersHorizontal className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-semibold sm:text-sm">Подобрать по Фильтрам</span>
                  {hasAdvancedFilters ? (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#d84040] ring-2 ring-white" />
                  ) : null}
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="flex h-full w-[300px] max-w-[90vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[300px]"
              >
                <SheetTitle className="sr-only">Фильтр</SheetTitle>
                {advancedFiltersPanel}
              </SheetContent>
            </Sheet>
            <div className="flex items-center justify-end gap-1">
            <Button
              size="icon"
              variant={cardSize === "xl" ? "default" : "outline"}
              onClick={() => setCardSize("xl")}
              title="Крупный"
              aria-label="Крупный"
            >
              <LayoutGrid className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant={cardSize === "m" ? "default" : "outline"}
              onClick={() => setCardSize("m")}
              title="Средний"
              aria-label="Средний"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant={cardSize === "s" ? "default" : "outline"}
              onClick={() => setCardSize("s")}
              title="Мелкий"
              aria-label="Мелкий"
            >
              <Grid2x2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant={cardSize === "list" ? "default" : "outline"}
              onClick={() => setCardSize("list")}
              title="Список"
              aria-label="Список"
            >
              <List className="h-4 w-4" />
            </Button>
            </div>
          </div>

          <div className="col-span-full flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="sr-only">Быстрые фильтры</span>
              <QuickFilterSegment
                active={onlyHit}
                onClick={() => setOnlyHit((v) => !v)}
                label="Хит"
              />
              <QuickFilterSegment
                active={onlyNew}
                onClick={() => setOnlyNew((v) => !v)}
                label="Новинки"
              />
              <QuickFilterSegment
                active={onlySale}
                onClick={() => setOnlySale((v) => !v)}
                label="Акции"
              />
              <QuickFilterSegment
                active={onlyInStock}
                onClick={() => setOnlyInStock((v) => !v)}
                label="В наличии"
              />
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Сортировка</Label>
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger className="h-8 w-full min-w-[200px] text-xs sm:w-[220px]" data-testid="catalog-sort-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">По умолчанию (рекомендуемые)</SelectItem>
                  <SelectItem value="name">По названию</SelectItem>
                  <SelectItem value="price_asc">Цена ↑</SelectItem>
                  <SelectItem value="price_desc">Цена ↓</SelectItem>
                  <SelectItem value="stock">По остатку</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
      ) : cardSize === "list" ? (
        <div className="divide-y rounded-lg border bg-card">
          {items.map((p) => (
            <ProductListRow key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className={gridCls}>
          {items.map((p) => (
            <ProductCardGrid key={p.id} product={p} size={cardSize} />
          ))}
        </div>
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

function CatalogAdvancedFilters({
  title,
  filtersData,
  filtersLoading,
  propFilters,
  setPropFilters,
  priceRange,
  priceBounds,
  onPriceChange,
  onReset,
  onApply,
  hasPendingChanges,
}: {
  title: string;
  filtersData: FiltersResponse | undefined;
  filtersLoading: boolean;
  propFilters: Record<string, string[]>;
  setPropFilters: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  priceRange: [number, number] | null;
  priceBounds: [number, number];
  onPriceChange: (v: [number, number]) => void;
  onReset: () => void;
  onApply: () => void;
  hasPendingChanges: boolean;
}) {
  const [bLo, bHi] = priceBounds;
  const sliderMax = bHi > bLo ? bHi : bLo + 1;
  const sliderValue = priceRange ?? [bLo, sliderMax];
  const groups = filtersData?.groups ?? [];
  const defaultOpen = useMemo(() => groups.map((g) => g.key), [groups]);
  const [openSections, setOpenSections] = useState<string[]>(defaultOpen);

  useEffect(() => {
    setOpenSections(groups.map((g) => g.key));
  }, [groups]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-[21px] pb-3 pt-[21px]">
        <h2 className="text-[22px] font-semibold leading-[26px] text-foreground">Фильтр</h2>
        <p className="mt-1 text-sm text-[#7d8e9a]">{title}</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-[21px] pb-[21px]">
        {filtersLoading && !filtersData ? (
          <p className="text-sm text-muted-foreground">Загружаю фильтры…</p>
        ) : (
          <div className="flex flex-col gap-5">
            {bHi > bLo && (
              <div className="space-y-3">
                <Label className="text-sm font-medium text-foreground">Цена, ₽</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    className="h-9 rounded-[2px] border-[#eeeff7] text-center text-foreground"
                    value={Math.round(sliderValue[0])}
                    min={bLo}
                    max={sliderValue[1]}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) onPriceChange([v, sliderValue[1]]);
                    }}
                  />
                  <Input
                    type="number"
                    className="h-9 rounded-[2px] border-[#eeeff7] text-center text-foreground"
                    value={Math.round(sliderValue[1])}
                    min={sliderValue[0]}
                    max={bHi}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) onPriceChange([sliderValue[0], v]);
                    }}
                  />
                </div>
                <Slider
                  min={bLo}
                  max={sliderMax}
                  step={1}
                  value={sliderValue}
                  className="[&_.bg-primary]:bg-[#9aca3c] [&_.border-primary]:border-[#9aca3c]"
                  onValueChange={(v) => {
                    if (v.length >= 2) onPriceChange([v[0]!, v[1]!]);
                  }}
                />
              </div>
            )}

            <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="w-full">
              {groups.map((group) => (
                <AccordionItem key={group.key} value={group.key} className="border-b border-[#e3e6f3]">
                  <AccordionTrigger className="py-2.5 text-sm font-medium text-foreground hover:no-underline">
                    {group.label}
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 pt-1">
                    <FilterCheckboxGroup
                      label={group.label}
                      kind={group.kind}
                      options={group.values}
                      selected={propFilters[group.key] ?? []}
                      onChange={(next) =>
                        setPropFilters((prev) => {
                          const copy = { ...prev };
                          if (next.length) copy[group.key] = next;
                          else delete copy[group.key];
                          return copy;
                        })
                      }
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-[#e3e6f3] px-[21px] py-[21px]">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-[42px] w-[42px] shrink-0 rounded-[2px]"
          onClick={onReset}
          aria-label="Сбросить фильтры"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          className="h-[42px] flex-1 bg-[#9aca3c] font-semibold text-white hover:bg-[#86b832]"
          onClick={onApply}
          disabled={filtersLoading}
          data-testid="catalog-filters-apply"
        >
          Применить
        </Button>
      </footer>
    </div>
  );
}

function QuickFilterSegment({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-lime-600 bg-lime-500 text-lime-950 shadow-sm"
          : "border-border bg-background text-foreground hover:border-muted-foreground/40 hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
