import { RUSSIAN_CITY_COORDINATES } from "@/lib/russian-city-coordinates.generated";

/** Нормализация для поиска в справочнике (без изменения отображаемого названия). */
export function normalizeCityLookupKey(city: string): string {
  return city
    .trim()
    .replace(/^г\.\s*/i, "")
    .replace(/^пос\.\s*/i, "")
    .replace(/^посёлок\s+/i, "")
    .replace(/^село\s+/i, "")
    .replace(/^пгт\.?\s*/i, "")
    .trim();
}

/** Координаты центра населённого пункта из справочника Release 1 или null. */
export function getCityLatLng(city: string): { lat: number; lng: number } | null {
  const t = city.trim();
  if (RUSSIAN_CITY_COORDINATES[t]) return RUSSIAN_CITY_COORDINATES[t];
  const n = normalizeCityLookupKey(city);
  if (n !== t && RUSSIAN_CITY_COORDINATES[n]) return RUSSIAN_CITY_COORDINATES[n];
  return null;
}
