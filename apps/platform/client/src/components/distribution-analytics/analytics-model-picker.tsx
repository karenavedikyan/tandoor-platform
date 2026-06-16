import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { Grid3x3, LayoutGrid, List, Search, Square } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CatalogViewToggle } from "@/components/catalog/catalog-view-toggle";
import { cn } from "@/lib/utils";
import type { CatalogProduct } from "@/lib/catalog-product-type";
import type { EquipmentTypeKey } from "@/lib/distribution-analytics/distribution-analytics-math";
import { inferShowcasePortalTypeFromCatalogProduct } from "@/lib/trade-point-showcase-matrix-required";

type CardSize = "xl" | "m" | "s" | "list";

const CARD_SIZE_KEY = "analytics-model-picker-card-size";

function readCardSize(): CardSize {
  if (typeof window === "undefined") return "m";
  const v = window.localStorage.getItem(CARD_SIZE_KEY);
  if (v === "xl" || v === "m" || v === "s" || v === "list") return v;
  return "m";
}

type Props = {
  /** Все модели-кандидаты (уже отфильтрованные по visibility — см. collectAnalyticsCatalogProducts). */
  products: CatalogProduct[];
  /** Активные типы оборудования из чипов «Товар» (ВХ/МК/Фурнитура). Если пусто — показываем все. */
  activeEquipmentTypes: EquipmentTypeKey[];
  /** Выбранные id моделей. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Для data-testid. */
  testId?: string;
};

const TYPE_LABEL: Record<EquipmentTypeKey, string> = {
  entrance: "ВХ",
  interior: "МК",
  hardware: "Фурнитура",
};

export function AnalyticsModelPicker({
  products,
  activeEquipmentTypes,
  value,
  onChange,
  testId = "analytics-model-picker",
}: Props): ReactElement {
  const [query, setQuery] = useState("");
  const [cardSize, setCardSize] = useState<CardSize>(readCardSize);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CARD_SIZE_KEY, cardSize);
    }
  }, [cardSize]);

  const selectedSet = useMemo(() => new Set(value), [value]);

  /** Сначала фильтр по чипам ВХ/МК/Фурнитура (если выбраны), потом по поисковой строке. */
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (activeEquipmentTypes.length > 0) {
        const t = inferShowcasePortalTypeFromCatalogProduct(p);
        if (t === "entrance" || t === "interior" || t === "hardware") {
          if (!activeEquipmentTypes.includes(t)) return false;
        } else {
          return false;
        }
      }
      if (q.length === 0) return true;
      const haystack = [
        p.name,
        p.article,
        p.category,
        p.series,
        p.manufacturer,
        ...(p.colors ?? []),
        ...(p.catalogTags ?? []),
        p.catalogSearchText ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [products, activeEquipmentTypes, query]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(value.filter((x) => x !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const gridCls = {
    xl: "grid grid-cols-1 gap-3 min-[650px]:grid-cols-2 min-[866px]:grid-cols-3",
    m: "grid grid-cols-2 gap-2 min-[650px]:grid-cols-3 min-[866px]:grid-cols-4",
    s: "grid grid-cols-3 gap-2 min-[650px]:grid-cols-4 min-[866px]:grid-cols-6",
  }[cardSize === "list" ? "m" : cardSize];

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-[12rem]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Название, бренд, цвет, коллекция…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-9"
            data-testid={`${testId}-search`}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <CatalogViewToggle
            active={cardSize === "xl"}
            onClick={() => setCardSize("xl")}
            title="Крупный"
            aria-label="Крупный"
            className="max-[865px]:hidden"
          >
            <Square className="h-5 w-5" />
          </CatalogViewToggle>
          <CatalogViewToggle
            active={cardSize === "m"}
            onClick={() => setCardSize("m")}
            title="Средний"
            aria-label="Средний"
          >
            <LayoutGrid className="h-5 w-5" />
          </CatalogViewToggle>
          <CatalogViewToggle
            active={cardSize === "s"}
            onClick={() => setCardSize("s")}
            title="Мелкий"
            aria-label="Мелкий"
            className="max-[865px]:hidden"
          >
            <Grid3x3 className="h-5 w-5" />
          </CatalogViewToggle>
          <CatalogViewToggle
            active={cardSize === "list"}
            onClick={() => setCardSize("list")}
            title="Список"
            aria-label="Список"
          >
            <List className="h-5 w-5" />
          </CatalogViewToggle>
        </div>
      </div>

      {value.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">
            Выбрано: <span className="font-semibold text-foreground">{value.length}</span>
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => onChange([])}
          >
            Очистить
          </Button>
        </div>
      ) : null}

      {filteredProducts.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
          Ничего не найдено. Уточните запрос.
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto rounded-md">
          {cardSize === "list" ? (
            <div className="divide-y divide-border overflow-hidden rounded-md border bg-card">
              {filteredProducts.map((p) => (
                <ModelRow key={p.id} product={p} selected={selectedSet.has(p.id)} onToggle={() => toggle(p.id)} />
              ))}
            </div>
          ) : (
            <div className={gridCls}>
              {filteredProducts.map((p) => (
                <ModelCard
                  key={p.id}
                  product={p}
                  size={cardSize as Exclude<CardSize, "list">}
                  selected={selectedSet.has(p.id)}
                  onToggle={() => toggle(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModelCard({
  product,
  size,
  selected,
  onToggle,
}: {
  product: CatalogProduct;
  size: "xl" | "m" | "s";
  selected: boolean;
  onToggle: () => void;
}): ReactElement {
  const portalType = inferShowcasePortalTypeFromCatalogProduct(product);
  const typeLabel =
    portalType === "entrance" || portalType === "interior" || portalType === "hardware"
      ? TYPE_LABEL[portalType]
      : null;

  const imgSize = { xl: "h-40", m: "h-28", s: "h-20" }[size];
  const titleSize = { xl: "text-sm", m: "text-xs", s: "text-[10px]" }[size];

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      data-testid={`analytics-model-card-${product.id}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition",
        selected
          ? "border-[#9aca3c] ring-2 ring-[#9aca3c]/40"
          : "border-border hover:border-[#9aca3c]/60",
      )}
    >
      <div className={cn("relative w-full overflow-hidden bg-muted/30", imgSize)}>
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-[10px] text-muted-foreground">
            нет фото
          </div>
        )}
        {typeLabel ? (
          <Badge
            variant="secondary"
            className="absolute left-1 top-1 h-5 rounded px-1.5 text-[9px] font-semibold"
          >
            {typeLabel}
          </Badge>
        ) : null}
        {selected ? (
          <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#9aca3c] text-white text-[11px] font-bold shadow">
            ✓
          </div>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 p-2">
        <p className={cn("truncate font-medium leading-tight", titleSize)}>{product.name}</p>
        {size !== "s" ? (
          <p className="truncate text-[10px] text-muted-foreground">
            {[product.series, product.category].filter(Boolean).join(" · ") || product.article}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function ModelRow({
  product,
  selected,
  onToggle,
}: {
  product: CatalogProduct;
  selected: boolean;
  onToggle: () => void;
}): ReactElement {
  const portalType = inferShowcasePortalTypeFromCatalogProduct(product);
  const typeLabel =
    portalType === "entrance" || portalType === "interior" || portalType === "hardware"
      ? TYPE_LABEL[portalType]
      : null;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      data-testid={`analytics-model-row-${product.id}`}
      className={cn(
        "flex w-full items-center gap-3 px-2 py-2 text-left transition hover:bg-muted/40",
        selected && "bg-[#9aca3c]/10",
      )}
    >
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted/30">
        {product.image ? (
          <img src={product.image} alt={product.name} className="h-full w-full object-contain" loading="lazy" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{product.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {[product.series, product.category, product.article].filter(Boolean).join(" · ")}
        </p>
      </div>
      {typeLabel ? (
        <Badge variant="secondary" className="h-5 shrink-0 rounded px-1.5 text-[10px]">
          {typeLabel}
        </Badge>
      ) : null}
      <div
        className={cn(
          "ml-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px]",
          selected ? "border-[#9aca3c] bg-[#9aca3c] text-white" : "border-border bg-card text-transparent",
        )}
      >
        ✓
      </div>
    </button>
  );
}
