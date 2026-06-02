import type { VercelRequest } from "@vercel/node";
import type { FilterGroupDef } from "./_filter-config.js";
import { buildGroupFilterClause } from "./_filter-build.js";
import { hiddenCategoryFilterSql } from "./_hidden.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_STR = 200;
const MAX_PRICE = 100_000_000;

/** Эффективная цена: акция, иначе РРЦ_Тандор. */
export const CATALOG_EFFECTIVE_PRICE_SQL = `COALESCE(
  (SELECT pr.value FROM catalog_prices pr
   JOIN catalog_price_types pt ON pt.id = pr.price_type_id
   WHERE pr.product_id = p.id AND LOWER(pt.name) LIKE '%акционнаяцена_тандор_розница%'
   LIMIT 1),
  (SELECT pr.value FROM catalog_prices pr
   JOIN catalog_price_types pt ON pt.id = pr.price_type_id
   WHERE pr.product_id = p.id AND LOWER(pt.name) LIKE '%ррц тандор%'
   LIMIT 1)
)`;

export type CatalogListFilters = {
  q?: string;
  categoryId?: string;
  groupId?: string;
  onlyInStock?: boolean;
  onlyNew?: boolean;
  onlyHit?: boolean;
  onlySale?: boolean;
  propFilters?: Map<string, string[]>;
  priceMin?: number;
  priceMax?: number;
};

function sanitizeStr(s: string, max = MAX_STR): string | null {
  const t = String(s).trim();
  if (!t || t.length > max) return null;
  return t;
}

function clampPrice(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, MAX_PRICE);
}

function parseUuid(raw: unknown): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string" || !UUID_RE.test(v)) return undefined;
  return v;
}

/** `props=Key:Val,Key2:Val2` (URL-encoded). */
export function parsePropsParam(raw: unknown): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const s = Array.isArray(raw) ? raw.join(",") : typeof raw === "string" ? raw : "";
  if (!s.trim()) return map;

  for (const segment of s.split(",")) {
    const part = segment.trim();
    if (!part) continue;
    let decoded = part;
    try {
      decoded = decodeURIComponent(part);
    } catch {
      /* use raw */
    }
    const colon = decoded.indexOf(":");
    if (colon <= 0) continue;
    const key = sanitizeStr(decoded.slice(0, colon));
    const val = sanitizeStr(decoded.slice(colon + 1));
    if (!key || !val) continue;
    const list = map.get(key) ?? [];
    if (!list.includes(val)) list.push(val);
    map.set(key, list);
  }
  return map;
}

function parseLegacyBrands(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : raw != null && raw !== "" ? [raw] : [];
  const out: string[] = [];
  for (const item of arr) {
    const v = sanitizeStr(String(item));
    if (v && !out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v);
  }
  return out;
}

export function propertyFilterMeta(key: string): { label: string; unit: string | null } {
  const comma = key.indexOf(",");
  if (comma === -1) return { label: key, unit: null };
  return {
    label: key.slice(0, comma).trim(),
    unit: key.slice(comma + 1).trim() || null,
  };
}

export function parseCatalogListFilters(req: VercelRequest): CatalogListFilters {
  const q = sanitizeStr(String(req.query.q ?? ""), 500) ?? undefined;
  const categoryId = parseUuid(req.query.category_id);
  const groupId = parseUuid(req.query.group_id);
  const onlyInStock = String(req.query.in_stock ?? "") === "1";
  const onlyNew = String(req.query.is_new ?? "") === "1";
  const onlyHit = String(req.query.is_hit ?? "") === "1";
  const onlySale = String(req.query.is_sale ?? "") === "1";
  const propFilters = parsePropsParam(req.query.props);
  const legacyBrand = parseLegacyBrands(req.query.brand);
  if (legacyBrand.length) {
    const list = propFilters.get("Бренд") ?? [];
    for (const b of legacyBrand) {
      if (!list.includes(b)) list.push(b);
    }
    propFilters.set("Бренд", list);
  }

  let priceMin: number | undefined;
  let priceMax: number | undefined;
  const pm = Number(req.query.price_min);
  const px = Number(req.query.price_max);
  if (req.query.price_min != null && req.query.price_min !== "" && Number.isFinite(pm)) {
    priceMin = clampPrice(pm);
  }
  if (req.query.price_max != null && req.query.price_max !== "" && Number.isFinite(px)) {
    priceMax = clampPrice(px);
  }

  return {
    q: q || undefined,
    categoryId,
    groupId,
    onlyInStock,
    onlyNew,
    onlyHit,
    onlySale,
    propFilters: propFilters.size ? propFilters : undefined,
    priceMin,
    priceMax,
  };
}

/**
 * WHERE-условия для catalog_products (алиас p).
 * includeListingFilters=false — только раздел/группа/hidden (для /filters).
 *
 * Листинг (125-A): условия применяются к каждому варианту; модель в выдаче,
 * если хотя бы один вариант проходит (см. CTE passing в buildGroupedProductsQuery).
 */
export function buildCatalogProductWhere(
  filters: CatalogListFilters,
  opts?: { includeListingFilters?: boolean; filterGroupDefs?: FilterGroupDef[] },
): { clauses: string[]; params: unknown[] } {
  const includeListing = opts?.includeListingFilters !== false;
  const clauses: string[] = ["p.active = TRUE"];
  const params: unknown[] = [];

  if (includeListing && filters.q) {
    params.push(`%${filters.q}%`);
    const n = params.length;
    clauses.push(`(
      p.name ILIKE $${n} OR
      p.display_name ILIKE $${n} OR
      COALESCE(p.brand, '') ILIKE $${n} OR
      EXISTS (
        SELECT 1 FROM catalog_product_properties pp
        WHERE pp.product_id = p.id
          AND pp.name IN ('Бренд','Цвет','НП. Коллекция','Артикул')
          AND pp.value ILIKE $${n}
      )
    )`);
  }

  if (filters.categoryId) {
    params.push(filters.categoryId);
    clauses.push(
      `EXISTS (SELECT 1 FROM catalog_product_categories pc WHERE pc.product_id = p.id AND pc.category_id = $${params.length}::uuid)`,
    );
  }
  if (filters.groupId) {
    params.push(filters.groupId);
    clauses.push(`p.group_id = $${params.length}::uuid`);
  }

  if (includeListing && filters.onlyInStock) {
    clauses.push(`EXISTS (SELECT 1 FROM catalog_stocks s WHERE s.product_id = p.id AND s.qty > 0)`);
  }
  if (includeListing && filters.onlyNew) {
    clauses.push(
      `EXISTS (SELECT 1 FROM catalog_product_properties pp WHERE pp.product_id = p.id AND LOWER(TRIM(pp.name)) = 'новинка' AND LOWER(TRIM(pp.value)) IN ('да','y','yes','true','1'))`,
    );
  }
  if (includeListing && filters.onlyHit) {
    clauses.push(
      `EXISTS (SELECT 1 FROM catalog_product_properties pp WHERE pp.product_id = p.id AND LOWER(TRIM(pp.name)) = 'хит продаж' AND LOWER(TRIM(pp.value)) IN ('да','y','yes','true','1'))`,
    );
  }
  if (includeListing && filters.onlySale) {
    clauses.push(
      `EXISTS (SELECT 1 FROM catalog_product_properties pp WHERE pp.product_id = p.id AND LOWER(TRIM(pp.name)) = 'акция' AND NULLIF(TRIM(pp.value), '') IS NOT NULL)`,
    );
  }

  const groupDefs = opts?.filterGroupDefs ?? [];

  if (includeListing && filters.propFilters) {
    for (const [groupKey, values] of filters.propFilters) {
      const clause = buildGroupFilterClause(groupKey, values, groupDefs, params);
      if (clause) clauses.push(clause);
    }
  }

  if (includeListing && (filters.priceMin != null || filters.priceMax != null)) {
    const parts: string[] = [`(${CATALOG_EFFECTIVE_PRICE_SQL}) IS NOT NULL`, `(${CATALOG_EFFECTIVE_PRICE_SQL}) > 0`];
    if (filters.priceMin != null) {
      params.push(filters.priceMin);
      parts.push(`(${CATALOG_EFFECTIVE_PRICE_SQL}) >= $${params.length}`);
    }
    if (filters.priceMax != null) {
      params.push(filters.priceMax);
      parts.push(`(${CATALOG_EFFECTIVE_PRICE_SQL}) <= $${params.length}`);
    }
    clauses.push(`(${parts.join(" AND ")})`);
  }

  const hidden = hiddenCategoryFilterSql(params.length + 1);
  if (hidden.sql) {
    clauses.push(hidden.sql.trim().replace(/^AND\s+/, ""));
    params.push(...hidden.params);
  }

  return { clauses, params };
}

export function whereSqlFromClauses(clauses: string[]): string {
  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

/** Строка props для query (клиент). */
export function encodePropsParam(propFilters: Record<string, string[]>): string {
  const pairs: string[] = [];
  for (const [k, vals] of Object.entries(propFilters)) {
    for (const v of vals) {
      pairs.push(`${encodeURIComponent(k)}:${encodeURIComponent(v)}`);
    }
  }
  return pairs.join(",");
}
