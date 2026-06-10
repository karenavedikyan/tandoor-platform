import type { ClientCategoryId } from "@/lib/client-category";
import { CLIENT_CATEGORY_META, getClientCategoryMeta } from "@/lib/client-category";
import type { CatalogProduct } from "@/lib/catalog-product-type";
import type {
  ShowcaseMatrixCatalogClientCategory,
  ShowcaseMatrixCatalogScopeKind,
  ShowcaseMatrixCatalogSegment,
  ShowcaseMatrixCatalogStatus,
  ShowcaseMatrixDefDto,
} from "@/lib/showcase-matrix-catalog-api";

export type MatrixCatalogListFilters = {
  clientCategory: ClientCategoryId | "all";
  status: ShowcaseMatrixCatalogStatus | "all";
  search: string;
};

export type MatrixCatalogStatusMeta = {
  label: string;
  badgeClassName: string;
};

const STATUS_META: Record<ShowcaseMatrixCatalogStatus, MatrixCatalogStatusMeta> = {
  draft: {
    label: "Черновик",
    badgeClassName:
      "border-border bg-muted/60 text-muted-foreground dark:bg-muted/40 dark:text-muted-foreground",
  },
  published: {
    label: "Опубликовано",
    badgeClassName:
      "border-emerald-500/50 bg-emerald-500/15 text-emerald-900 dark:border-emerald-400/60 dark:bg-emerald-400/20 dark:text-emerald-100",
  },
  archived: {
    label: "Архив",
    badgeClassName:
      "border-border/80 bg-muted/30 text-muted-foreground/80 dark:bg-muted/20 dark:text-muted-foreground/70",
  },
};

export function matrixDefStatusMeta(status: ShowcaseMatrixCatalogStatus): MatrixCatalogStatusMeta {
  return STATUS_META[status];
}

export function formatMatrixCatalogDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatMatrixDefPeriodLabel(
  effectiveFrom: string | null,
  effectiveTo: string | null,
): string {
  const from = effectiveFrom ? formatMatrixCatalogDate(effectiveFrom) : "с любой даты";
  const to = effectiveTo ? formatMatrixCatalogDate(effectiveTo) : "бессрочно";
  if (!effectiveFrom && !effectiveTo) return "бессрочно";
  return `${from} – ${to}`;
}

export function formatMatrixDefScopeLabel(def: Pick<
  ShowcaseMatrixDefDto,
  "scopeKind" | "scopeRegion" | "scopeCity"
>): string {
  if (def.scopeKind === "global") return "Глобально";
  if (def.scopeKind === "region") {
    const r = def.scopeRegion?.trim();
    return r ? `Регион «${r}»` : "Регион";
  }
  const city = def.scopeCity?.trim() ?? "";
  const region = def.scopeRegion?.trim() ?? "";
  if (city && region) return `Город «${city}, ${region}»`;
  if (city) return `Город «${city}»`;
  return "Город";
}

export function formatMatrixDefUpdatedLabel(def: Pick<
  ShowcaseMatrixDefDto,
  "updatedAt" | "updatedByName"
>): string {
  const when = formatMatrixCatalogDate(def.updatedAt);
  const who = def.updatedByName?.trim();
  if (who) return `${who}, ${when}`;
  return when || "—";
}

export function isMatrixPeriodRangeValid(
  effectiveFrom: string | null,
  effectiveTo: string | null,
): boolean {
  if (!effectiveFrom || !effectiveTo) return true;
  return effectiveFrom <= effectiveTo;
}

export function matrixDefMatchesSearch(def: ShowcaseMatrixDefDto, rawQuery: string): boolean {
  const q = rawQuery.trim().toLocaleLowerCase("ru");
  if (!q) return true;
  const hay = [
    def.scopeRegion,
    def.scopeCity,
    def.title,
    def.seasonLabel,
    def.comment,
    formatMatrixDefScopeLabel(def),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ru");
  return hay.includes(q);
}

export function filterMatrixDefs(
  defs: ShowcaseMatrixDefDto[],
  filters: MatrixCatalogListFilters,
): ShowcaseMatrixDefDto[] {
  return defs.filter((def) => {
    if (filters.clientCategory !== "all" && def.clientCategory !== filters.clientCategory) return false;
    if (filters.status !== "all" && def.status !== filters.status) return false;
    if (!matrixDefMatchesSearch(def, filters.search)) return false;
    return true;
  });
}

export type MatrixCatalogClientCategoryGroup = {
  clientCategory: ClientCategoryId;
  label: string;
  badgeClassName: string;
  order: number;
  defs: ShowcaseMatrixDefDto[];
};

export function groupMatrixDefsByClientCategory(
  defs: ShowcaseMatrixDefDto[],
): MatrixCatalogClientCategoryGroup[] {
  const byCategory = new Map<ClientCategoryId, ShowcaseMatrixDefDto[]>();
  for (const def of defs) {
    const cat = def.clientCategory as ClientCategoryId;
    const list = byCategory.get(cat) ?? [];
    list.push(def);
    byCategory.set(cat, list);
  }

  const groups: MatrixCatalogClientCategoryGroup[] = [];
  for (const meta of CLIENT_CATEGORY_META) {
    const list = byCategory.get(meta.id);
    if (!list?.length) continue;
    const sorted = [...list].sort(compareMatrixDefsWithinCategory);
    groups.push({
      clientCategory: meta.id,
      label: meta.label,
      badgeClassName: meta.badgeClassName,
      order: meta.order,
      defs: sorted,
    });
  }
  return groups.sort((a, b) => a.order - b.order);
}

function compareMatrixDefsWithinCategory(a: ShowcaseMatrixDefDto, b: ShowcaseMatrixDefDto): number {
  const scopeOrder: Record<ShowcaseMatrixCatalogScopeKind, number> = { global: 0, region: 1, city: 2 };
  const sa = scopeOrder[a.scopeKind] ?? 9;
  const sb = scopeOrder[b.scopeKind] ?? 9;
  if (sa !== sb) return sa - sb;
  const regionCmp = (a.scopeRegion ?? "").localeCompare(b.scopeRegion ?? "", "ru");
  if (regionCmp !== 0) return regionCmp;
  const cityCmp = (a.scopeCity ?? "").localeCompare(b.scopeCity ?? "", "ru");
  if (cityCmp !== 0) return cityCmp;
  const fromCmp = (b.effectiveFrom ?? "").localeCompare(a.effectiveFrom ?? "");
  if (fromCmp !== 0) return fromCmp;
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function inferMatrixSegmentFromCatalogProduct(
  product: CatalogProduct | undefined,
): ShowcaseMatrixCatalogSegment {
  if (!product) return "vh";
  if (product.doorKind === "Межкомнатная") return "mk";
  if (product.doorKind === "Входная") return "vh";
  if (product.category?.toLocaleLowerCase("ru").includes("фурнитур")) return "hardware";
  return "hardware";
}

/** Сегмент матрицы по подсказкам из каталога 1С (название, тип двери, категория). */
export function inferMatrixSegmentFrom1c(hint: string | null | undefined): ShowcaseMatrixCatalogSegment {
  const h = (hint ?? "").toLocaleLowerCase("ru");
  if (h.includes("межкомнат")) return "mk";
  if (h.includes("входн")) return "vh";
  if (h.includes("фурнитур")) return "hardware";
  return "vh";
}

export function clientCategoryLabel(id: ShowcaseMatrixCatalogClientCategory): string {
  return getClientCategoryMeta(id as ClientCategoryId).label;
}
