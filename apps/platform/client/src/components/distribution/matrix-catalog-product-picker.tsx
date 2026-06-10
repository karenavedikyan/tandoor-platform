import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { optimizedImage } from "@/lib/catalog-image";
import { cn } from "@/lib/utils";

type DoorFilter = "all" | "entrance" | "interior";

export type Catalog1cListItem = {
  id: string;
  name: string;
  display_name: string | null;
  brand: string | null;
  image_path: string | null;
  image_url: string | null;
  door_types: Array<{ value: string; product_id: string }>;
};

export type Catalog1cPicked = {
  id: string;
  name: string;
  displayName?: string | null;
  doorTypeHint?: string | null;
  categoryHint?: string | null;
  imageUrl?: string | null;
  brand?: string | null;
};

function doorFilterLabel(f: DoorFilter): string {
  if (f === "entrance") return "ВХ";
  if (f === "interior") return "МК";
  return "Все";
}

function doorKindFromItem(item: Catalog1cListItem): DoorFilter | "unknown" {
  const values = (item.door_types ?? []).map((d) => d.value.toLocaleLowerCase("ru"));
  if (values.some((v) => v.includes("входн"))) return "entrance";
  if (values.some((v) => v.includes("межкомнат"))) return "interior";
  return "unknown";
}

function matchesDoorFilter(item: Catalog1cListItem, filter: DoorFilter): boolean {
  if (filter === "all") return true;
  const kind = doorKindFromItem(item);
  if (kind === "unknown") return true;
  return kind === filter;
}

function toPicked(item: Catalog1cListItem): Catalog1cPicked {
  const doorHint = item.door_types?.map((d) => d.value).filter(Boolean).join(", ") || null;
  return {
    id: item.id,
    name: item.name,
    displayName: item.display_name,
    doorTypeHint: doorHint,
    imageUrl: item.image_url ?? item.image_path,
    brand: item.brand,
  };
}

export type MatrixCatalogProductPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeIds: Set<string>;
  onConfirm: (products: Catalog1cPicked[]) => void;
};

export function MatrixCatalogProductPicker(props: MatrixCatalogProductPickerProps): ReactElement {
  const { open, onOpenChange, excludeIds, onConfirm } = props;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [doorFilter, setDoorFilter] = useState<DoorFilter>("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [items, setItems] = useState<Catalog1cListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const itemsByIdRef = useRef<Map<string, Catalog1cListItem>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    params.set("limit", debouncedSearch ? "80" : "40");
    params.set("offset", "0");

    void (async () => {
      try {
        const r = await fetch(`/api/catalog/products?${params}`, {
          credentials: "include",
          signal: ac.signal,
        });
        const data = await r.json();
        if (!r.ok || !data.success) {
          throw new Error(data.message || `HTTP ${r.status}`);
        }
        const list = (data.items ?? []) as Catalog1cListItem[];
        if (ac.signal.aborted) return;
        const map = new Map<string, Catalog1cListItem>();
        for (const item of list) map.set(item.id, item);
        itemsByIdRef.current = map;
        setItems(list);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setItems([]);
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [open, debouncedSearch]);

  const results = useMemo(() => {
    return items
      .filter((p) => !excludeIds.has(p.id))
      .filter((p) => matchesDoorFilter(p, doorFilter));
  }, [items, excludeIds, doorFilter]);

  const toggle = (id: string, checked: boolean) => {
    setPicked((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const handleConfirm = () => {
    const products = picked
      .map((id) => itemsByIdRef.current.get(id))
      .filter((p): p is Catalog1cListItem => Boolean(p))
      .map(toPicked);
    onConfirm(products);
    setPicked([]);
    setSearch("");
    setDebouncedSearch("");
    setDoorFilter("all");
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPicked([]);
      setSearch("");
      setDebouncedSearch("");
      setDoorFilter("all");
      setItems([]);
      setError(null);
    }
    onOpenChange(next);
  };

  const hasDoorTypeData = items.some((item) => doorKindFromItem(item) !== "unknown");

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Добавить модели из каталога</SheetTitle>
        </SheetHeader>

        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по названию, бренду, артикулу"
            className="pl-9"
            data-testid="input-matrix-catalog-picker-search"
          />
        </div>

        {hasDoorTypeData ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {(["all", "entrance", "interior"] as DoorFilter[]).map((f) => (
              <Button
                key={f}
                type="button"
                size="sm"
                variant={doorFilter === f ? "default" : "outline"}
                onClick={() => setDoorFilter(f)}
                data-testid={`button-matrix-catalog-picker-filter-${f}`}
              >
                {doorFilterLabel(f)}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Загрузка
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground">По запросу ничего не найдено.</p>
          ) : (
            <ul className="space-y-2">
              {results.map((p) => {
                const checked = picked.includes(p.id);
                const label = p.display_name?.trim() || p.name;
                const imgSrc = p.image_url?.trim() || p.image_path?.trim();
                const thumb = imgSrc ? optimizedImage(imgSrc, 96) : null;
                const typeShort =
                  doorKindFromItem(p) === "entrance"
                    ? "ВХ"
                    : doorKindFromItem(p) === "interior"
                      ? "МК"
                      : null;
                return (
                  <li
                    key={p.id}
                    className={cn(
                      "flex gap-3 rounded-lg border border-border bg-card p-2",
                      checked && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggle(p.id, v === true)}
                      aria-label={`Выбрать ${label}`}
                      data-testid={`checkbox-matrix-catalog-picker-${p.id}`}
                    />
                    <div className="flex min-w-0 flex-1 gap-2">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted/40">
                        {thumb ? (
                          <img src={thumb} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Нет фото</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium text-foreground">{label}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {typeShort ? (
                            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                              {typeShort}
                            </Badge>
                          ) : null}
                          {p.brand?.trim() ? (
                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                              {p.brand}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-4 flex shrink-0 flex-wrap gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Отмена
          </Button>
          <Button
            type="button"
            disabled={picked.length === 0}
            onClick={handleConfirm}
            data-testid="button-matrix-catalog-picker-confirm"
          >
            Добавить ({picked.length})
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
