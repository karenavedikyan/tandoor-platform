import type { RangeBucketDef } from "./_filter-config.js";
import { BRAND_GEO_BLOCKLIST, PROPERTY_BLACKLIST } from "./_filter-config.js";

const GUID_RE =
  /#?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const GUID_LIST_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}.*[0-9a-f]{8}-[0-9a-f]{4}/i;

export const MAX_FILTER_VALUE_LEN = 60;

/** SQL-выражение нормализации значения свойства (алиас pp). */
export const PROP_VALUE_NORM_SQL = `LOWER(REPLACE(REPLACE(TRIM(pp.value),'ё','е'),'Ё','Е'))`;

/** SQL: извлечь первое число из значения свойства. */
export const PROP_VALUE_NUMERIC_SQL = `(
  NULLIF(
    REGEXP_REPLACE(REPLACE(TRIM(pp.value), ',', '.'), '[^0-9.]', '', 'g'),
    ''
  )::numeric
)`;

export function normalizeValueKey(value: string): string {
  return value
    .trim()
    .replace(/ё/g, "е")
    .replace(/Ё/g, "Е")
    .toLowerCase();
}

export function isJunkPropertyValue(value: string, propName?: string): boolean {
  const t = value.trim();
  if (!t) return true;
  if (t.length > MAX_FILTER_VALUE_LEN) return true;
  if (propName && PROPERTY_BLACKLIST.has(propName)) return true;
  if (t.startsWith("#")) return true;
  if (GUID_RE.test(t)) return true;
  if (GUID_LIST_RE.test(t)) return true;
  return false;
}

export function isBrandGeoValue(value: string, countryValuesNorm: Set<string>): boolean {
  const norm = normalizeValueKey(value);
  if (BRAND_GEO_BLOCKLIST.has(norm)) return true;
  if (countryValuesNorm.has(norm)) return true;
  return false;
}

export function parseNumericPropertyValue(value: string): number | null {
  const cleaned = value.trim().replace(",", ".");
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

export function valueMatchesBucket(n: number, bucket: RangeBucketDef): boolean {
  if (bucket.min != null && n < bucket.min) return false;
  if (bucket.max != null && n > bucket.max) return false;
  return true;
}

export function bucketsForNumericValue(
  n: number,
  buckets: RangeBucketDef[],
): RangeBucketDef[] {
  return buckets.filter((b) => valueMatchesBucket(n, b));
}

export type CollapsedValue = {
  display: string;
  normKey: string;
  count: number;
};

/** Схлопывание дублей по normKey; display — самый частый исходный вариант. */
export function collapsePropertyValues(
  rows: Array<{ value: string; count: number }>,
  propName?: string,
): CollapsedValue[] {
  const byNorm = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (isJunkPropertyValue(row.value, propName)) continue;
    const normKey = normalizeValueKey(row.value);
    const raw = row.value.trim();
    if (!byNorm.has(normKey)) byNorm.set(normKey, new Map());
    const rawMap = byNorm.get(normKey)!;
    rawMap.set(raw, (rawMap.get(raw) ?? 0) + row.count);
  }
  const out: CollapsedValue[] = [];
  for (const [normKey, rawMap] of byNorm) {
    let display = "";
    let bestCnt = 0;
    let total = 0;
    for (const [raw, cnt] of rawMap) {
      total += cnt;
      if (cnt > bestCnt) {
        bestCnt = cnt;
        display = raw;
      }
    }
    out.push({ normKey, display, count: total });
  }
  return out.sort((a, b) => b.count - a.count || a.display.localeCompare(b.display, "ru"));
}

export const BOOLEAN_YES_SQL = `LOWER(TRIM(pp.value)) IN ('да','y','yes','true','1')`;
