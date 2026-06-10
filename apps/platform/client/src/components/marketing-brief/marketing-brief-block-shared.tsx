import type {
  BonusBlockItem,
  BonusBlockPayload,
  BriefProductSegment,
  PriceTableBlockPayload,
  PriceTableRow,
  ProductsBlockItem,
  ProductsBlockPayload,
} from "@/lib/marketing-briefs-api";
import { Badge } from "@/components/ui/badge";
import { catalog1cProductHref, isCatalog1cProductId } from "@/lib/catalog-1c-product-link";
import { cn } from "@/lib/utils";

export { catalog1cProductHref, isCatalog1cProductId };

export const BRIEF_SEGMENT_OPTIONS: { key: BriefProductSegment; label: string }[] = [
  { key: "top150", label: "ТОП-150" },
  { key: "top350", label: "ТОП-350" },
  { key: "top500", label: "ТОП-500" },
  { key: "top500plus", label: "ТОП-500+" },
];

export function newBriefBlockItemId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function formatBriefPriceRub(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

export function parseBriefPriceInput(raw: string): number | null {
  const t = raw.replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function formatBriefDateRu(iso: string | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function parseSegments(raw: unknown): BriefProductSegment[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(BRIEF_SEGMENT_OPTIONS.map((o) => o.key));
  return raw.filter((x): x is BriefProductSegment => typeof x === "string" && allowed.has(x as BriefProductSegment));
}

function parseProductItem(raw: unknown): ProductsBlockItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : newBriefBlockItemId();
  return {
    id,
    catalog_id: r.catalog_id != null ? String(r.catalog_id) : null,
    manual: r.manual === true,
    name: typeof r.name === "string" ? r.name : undefined,
    article: typeof r.article === "string" ? r.article : undefined,
    image_url: typeof r.image_url === "string" ? r.image_url : undefined,
    price_showroom:
      typeof r.price_showroom === "number"
        ? r.price_showroom
        : r.price_showroom === null
          ? null
          : undefined,
    price_retail:
      typeof r.price_retail === "number" ? r.price_retail : r.price_retail === null ? null : undefined,
    note: typeof r.note === "string" ? r.note : undefined,
    segments: parseSegments(r.segments),
  };
}

export function asProductsBlock(payload: Record<string, unknown>): ProductsBlockPayload {
  const itemsRaw = payload.items;
  const items: ProductsBlockItem[] = [];
  if (Array.isArray(itemsRaw)) {
    for (const row of itemsRaw) {
      const item = parseProductItem(row);
      if (item) items.push(item);
    }
  }
  return {
    heading: typeof payload.heading === "string" ? payload.heading : "",
    items,
  };
}

function parsePriceRow(raw: unknown): PriceTableRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    id: typeof r.id === "string" ? r.id : newBriefBlockItemId(),
    model: typeof r.model === "string" ? r.model : "",
    price_old:
      typeof r.price_old === "number" ? r.price_old : r.price_old === null ? null : undefined,
    price_new:
      typeof r.price_new === "number" ? r.price_new : r.price_new === null ? null : undefined,
    note: typeof r.note === "string" ? r.note : undefined,
  };
}

export function asPriceTableBlock(payload: Record<string, unknown>): PriceTableBlockPayload {
  const rowsRaw = payload.rows;
  const rows: PriceTableRow[] = [];
  if (Array.isArray(rowsRaw)) {
    for (const row of rowsRaw) {
      const parsed = parsePriceRow(row);
      if (parsed) rows.push(parsed);
    }
  }
  return {
    heading: typeof payload.heading === "string" ? payload.heading : "",
    rows,
    show_benefit: payload.show_benefit !== false,
  };
}

function parseBonusItem(raw: unknown): BonusBlockItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    id: typeof r.id === "string" ? r.id : newBriefBlockItemId(),
    trigger: typeof r.trigger === "string" ? r.trigger : "",
    reward: typeof r.reward === "string" ? r.reward : "",
    audience: typeof r.audience === "string" ? r.audience : undefined,
    conditions: typeof r.conditions === "string" ? r.conditions : undefined,
    valid_until: typeof r.valid_until === "string" ? r.valid_until : undefined,
    require_photo_report: r.require_photo_report === true,
  };
}

export function asBonusBlock(payload: Record<string, unknown>): BonusBlockPayload {
  const itemsRaw = payload.items;
  const items: BonusBlockItem[] = [];
  if (Array.isArray(itemsRaw)) {
    for (const row of itemsRaw) {
      const item = parseBonusItem(row);
      if (item) items.push(item);
    }
  }
  return {
    heading: typeof payload.heading === "string" ? payload.heading : "",
    items,
  };
}

export function calcPriceBenefit(oldP: number | null | undefined, newP: number | null | undefined): number | null {
  if (oldP == null || newP == null || !Number.isFinite(oldP) || !Number.isFinite(newP)) return null;
  if (oldP <= newP) return null;
  return oldP - newP;
}

export function productDisplayName(item: ProductsBlockItem): string {
  return item.name?.trim() || "Без названия";
}

export function SegmentMultiSelect({
  value,
  onChange,
  disabled,
}: {
  value: BriefProductSegment[];
  onChange: (next: BriefProductSegment[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {BRIEF_SEGMENT_OPTIONS.map((opt) => {
        const active = value.includes(opt.key);
        return (
          <button
            key={opt.key}
            type="button"
            disabled={disabled}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
              active
                ? "border-[#9ACA3C]/60 bg-[#9ACA3C]/15 text-[#5a7a28]"
                : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50",
              disabled && "pointer-events-none opacity-60",
            )}
            onClick={() => {
              onChange(active ? value.filter((k) => k !== opt.key) : [...value, opt.key]);
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentBadges({ segments }: { segments?: BriefProductSegment[] }) {
  if (!segments?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {segments.map((s) => {
        const label = BRIEF_SEGMENT_OPTIONS.find((o) => o.key === s)?.label ?? s;
        return (
          <Badge key={s} variant="outline" className="text-[10px]">
            {label}
          </Badge>
        );
      })}
    </div>
  );
}
