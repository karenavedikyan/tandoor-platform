/**
 * Лёгкий разбор географии из city / releaseAddress без внешней геокодировки.
 * Используется только для фильтров клиентской базы.
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";

export type DealerGeoParts = {
  /** Край / область / республика */
  region: string;
  /** Муниципальный район */
  district: string;
  /** Населённый пункт (из адреса или city) */
  locality: string;
};

const SETTLEMENT_PREFIX = /^(?:г\.?|пгт\.?|пос\.?|с\.?|д\.?|х\.?|ст-ца\.?)\s*/i;

/** Нормализация для сравнения значений фильтра. */
export function normalizeGeoCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .replace(/\bобл\b/g, "область")
    .replace(/\bр-н\b/g, "район")
    .replace(/\bресп\b/g, "республика")
    .trim();
}

function cleanLabel(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function looksLikeRegion(part: string): boolean {
  const t = part.toLowerCase();
  if (/\b(?:область|обл\.?)\b/.test(t)) return true;
  if (/\bкрай\b/.test(t)) return true;
  if (/\b(?:республика|респ\.)\b/.test(t)) return true;
  if (/(?:ая|яя|ий|ой)\s+область$/i.test(part.trim())) return true;
  return false;
}

function looksLikeDistrict(part: string): boolean {
  const t = part.toLowerCase();
  return /\bр-н\b/.test(t) || /\bрайон\b/.test(t);
}

function extractSettlementName(part: string): string | null {
  const m = part.match(SETTLEMENT_PREFIX);
  if (!m) return null;
  const rest = part.slice(m[0].length).trim();
  return rest ? cleanLabel(rest) : null;
}

/**
 * Извлекает регион / район / населённый пункт из города и адреса.
 * Если адрес не парсится, locality = city (если city не пустой).
 */
export function parseDealerGeoFromRow(row: Pick<DealerRow, "city" | "releaseAddress">): DealerGeoParts {
  const city = (row.city ?? "").trim();
  const addr = (row.releaseAddress ?? "").trim();

  let region = "";
  let district = "";
  let locality = city ? cleanLabel(city) : "";

  if (addr) {
    const parts = addr.split(/[,;]/).map((p) => cleanLabel(p)).filter(Boolean);
    for (const part of parts) {
      if (!region && looksLikeRegion(part)) {
        region = cleanLabel(part.replace(/\s*обл\.?\s*$/i, " область").replace(/\s*респ\.?\s*$/i, " Республика"));
        continue;
      }
      if (!district && looksLikeDistrict(part)) {
        district = cleanLabel(part.replace(/\s*р-н\.?\s*/i, " ").replace(/\s*район\s*$/i, " район"));
        continue;
      }
      const fromSettle = extractSettlementName(part);
      if (fromSettle) {
        locality = fromSettle;
      }
    }
    if (!region && parts[0] && looksLikeRegion(parts[0])) {
      region = cleanLabel(parts[0].replace(/\s*обл\.?\s*$/i, " область"));
    }
  }

  if (!locality && city) locality = cleanLabel(city);

  return { region, district, locality };
}

export function rowMatchesGeoFilters(
  row: Pick<DealerRow, "city" | "releaseAddress">,
  geoRegion: string,
  geoDistrict: string,
  geoLocality: string,
): boolean {
  const r = geoRegion.trim();
  const d = geoDistrict.trim();
  const l = geoLocality.trim();
  if (!r && !d && !l) return true;

  const p = parseDealerGeoFromRow(row);
  const cityN = normalizeGeoCompare(row.city ?? "");

  if (r && normalizeGeoCompare(p.region) !== normalizeGeoCompare(r)) return false;
  if (d && normalizeGeoCompare(p.district) !== normalizeGeoCompare(d)) return false;
  if (l) {
    const locOk =
      normalizeGeoCompare(p.locality) === normalizeGeoCompare(l) ||
      cityN === normalizeGeoCompare(l);
    if (!locOk) return false;
  }
  return true;
}
