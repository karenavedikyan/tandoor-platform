/**
 * Логика fallback координат для карты клиентов (без геокодинга в браузере).
 * Защита от неоднозначных названий (напр. «Ленинградская» станица в Краснодарском крае vs ЛО).
 */

import type { DealerRow } from "./dealer-base-mock-data.js";
import { RUSSIAN_CITY_CENTERS } from "./russian-city-centers.generated.js";
import { normalizeCityLookupKey } from "./russian-city-coordinates.js";

/** Доп. центры для составных ключей (не city-only). Координаты офлайн-подобраны / OSM-уровень точности. */
export const CLIENT_MAP_EXTRA_FALLBACK_CENTERS: Record<string, { lat: number; lng: number }> = {
  "Краснодарский край, Ленинградский район, станица Ленинградская": { lat: 46.3214, lng: 39.3876 },
  "станица Ленинградская, Краснодарский край, Ленинградский район": { lat: 46.3214, lng: 39.3876 },
};

/** Короткие частые названия: city-only lookup опасен без регионального контекста в адресе. */
const AMBIGUOUS_SETTLEMENT_NAMES = new Set(
  [
    "ленинградская",
    "павловская",
    "кировская",
    "советская",
    "октябрьская",
    "калининская",
    "новомихайловский",
    "александровское",
    "алексеевка",
    "весёлое",
    "красное",
    "михайловка",
    "николаевка",
  ].map((s) => s.toLowerCase()),
);

type GeoBox = { minLat: number; maxLat: number; minLng: number; maxLng: number };

/** Если в тексте адреса явно указан субъект РФ — координата должна попадать в ориентировочный bbox. */
const SUBJECT_GEO_RULES: { test: (t: string) => boolean; box: GeoBox }[] = [
  {
    test: (t) => /краснодарск(?:ий|ого)\s+край/i.test(t),
    box: { minLat: 43.0, maxLat: 47.6, minLng: 36.0, maxLng: 42.3 },
  },
  {
    test: (t) =>
      /(ленинградская\s+область|ленинградской\s+области|ленинградская\s+обл\.?|санкт-петербург)/i.test(t) &&
      !/краснодарск(?:ий|ого)\s+край/i.test(t),
    box: { minLat: 58.0, maxLat: 61.5, minLng: 27.5, maxLng: 35.9 },
  },
  {
    test: (t) => /(ростовская\s+область|ростовской\s+области|ростовская\s+обл\.?)/i.test(t),
    box: { minLat: 45.5, maxLat: 50.5, minLng: 37.5, maxLng: 44.5 },
  },
  {
    test: (t) => /(ставропольск(?:ий|ого)\s+край)/i.test(t),
    box: { minLat: 43.5, maxLat: 46.2, minLng: 40.5, maxLng: 46.5 },
  },
];

function inBox(lat: number, lng: number, box: GeoBox): boolean {
  return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
}

/** Нормализация названия населённого пункта для сравнения с allow/block списками. */
export function normalizeSettlementName(name: string): string {
  return name
    .trim()
    .replace(/^г\.\s*/i, "")
    .replace(/^пос\.\s*/i, "")
    .replace(/^посёлок\s+/i, "")
    .replace(/^пгт\.?\s*/i, "")
    .replace(/^ст-ца\.?\s*/i, "")
    .replace(/^станица\s+/i, "")
    .replace(/^село\s+/i, "")
    .replace(/^деревня\s+/i, "")
    .replace(/^хутор\s+/i, "")
    .toLowerCase();
}

export function isAmbiguousSettlementName(cityOrSettlement: string): boolean {
  return AMBIGUOUS_SETTLEMENT_NAMES.has(normalizeSettlementName(cityOrSettlement));
}

function normalizeDistrict(segment: string): string {
  const s = segment.trim();
  if (/\s+р-н\.?$/i.test(s)) return s.replace(/\s+р-н\.?$/i, " район").trim();
  if (/\s+район$/i.test(s)) return s;
  return s;
}

function parseSettlementFromSegment(segment: string): { name: string; kind: string } | null {
  const s = segment.trim();
  const m = /^(.+?)\s+(ст-ца|станица|село|посёлок|пгт|деревня|хутор|сл\.|слобода)$/i.exec(s);
  if (!m) return null;
  const name = m[1]!.trim();
  const rawKind = m[2]!.toLowerCase();
  const kind = rawKind === "ст-ца" || rawKind === "станица" ? "станица" : rawKind;
  return { name, kind };
}

/** Первый (наиболее специфичный) ключ fallback или undefined. */
export function buildLocationFallbackKey(dealer: DealerRow): string | undefined {
  return buildLocationFallbackKeys(dealer)[0];
}

/**
 * Собирает приоритетный список строк для поиска в RUSSIAN_CITY_CENTERS + CLIENT_MAP_EXTRA_FALLBACK_CENTERS.
 * Не включает опасный city-only для неоднозначных названий.
 */
export function buildLocationFallbackKeys(dealer: DealerRow): string[] {
  const addr = (dealer.releaseAddress || "").trim();
  const city = (dealer.city || "").trim();
  const keys: string[] = [];

  if (addr) {
    const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);
    let region: string | undefined;
    let district: string | undefined;
    let settlementSeg: string | undefined;

    for (const p of parts) {
      if (/^\d{6}$/.test(p)) continue;
      if (/край$|область$|обл\.?$|Республика$|Респ\.?$/i.test(p)) region = p;
      else if (/\s+р-н\.?$|район$/i.test(p)) district = normalizeDistrict(p);
      else if (/ст-ца|станица|село|посёлок|пгт|деревня|хутор|слобода/i.test(p)) settlementSeg = p;
    }

    if (region && district && settlementSeg) {
      const st = parseSettlementFromSegment(settlementSeg);
      if (st) {
        const { name, kind } = st;
        keys.push(`${region}, ${district}, ${kind} ${name}`);
        keys.push(`${kind} ${name}, ${region}, ${district}`);
        keys.push(`${name}, ${region}, ${district}`);
      }
    }
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keys) {
    const t = k.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }

  if (city) {
    const n = normalizeCityLookupKey(city);
    const cityKey = n || city;
    if (!isAmbiguousSettlementName(city)) {
      if (!seen.has(cityKey)) {
        seen.add(cityKey);
        out.push(cityKey);
      }
    }
  }

  return out;
}

function lookupCenterRaw(key: string): { lat: number; lng: number } | null {
  const t = key.trim();
  if (!t) return null;
  const ex = CLIENT_MAP_EXTRA_FALLBACK_CENTERS[t];
  if (ex) return ex;
  const fromGen = RUSSIAN_CITY_CENTERS[t];
  if (fromGen) return fromGen;
  const n = normalizeCityLookupKey(t);
  if (n !== t && RUSSIAN_CITY_CENTERS[n]) return RUSSIAN_CITY_CENTERS[n];
  return null;
}

/**
 * Проверка: координата не противоречит явным региональным маркерам в адресе/городе.
 * Если маркеров нет — true.
 */
export function isCoordinateConsistentWithAddress(lat: number, lng: number, dealer: DealerRow): boolean {
  const text = `${dealer.releaseAddress || ""}\n${dealer.city || ""}`;
  const applicable = SUBJECT_GEO_RULES.filter((r) => r.test(text));
  if (applicable.length === 0) return true;
  return applicable.some((r) => inBox(lat, lng, r.box));
}

export function tryResolveFallbackCoordinate(
  dealer: DealerRow,
): { lat: number; lng: number; lookupKey: string } | null {
  const keys = buildLocationFallbackKeys(dealer);
  for (const key of keys) {
    const c = lookupCenterRaw(key);
    if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
    if (!isCoordinateConsistentWithAddress(c.lat, c.lng, dealer)) continue;
    return { lat: c.lat, lng: c.lng, lookupKey: key };
  }
  return null;
}
