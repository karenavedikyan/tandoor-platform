import { RUSSIAN_CITY_CENTERS } from "./russian-city-centers.generated.js";

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

/**
 * Проверенный центр города (Photon / импорт CSV), без детерминированных «фейков».
 * Если города нет в справочнике — null (карта не рисует точку по городу).
 */
export function getCityLatLng(city: string): { lat: number; lng: number } | null {
  const t = city.trim();
  if (RUSSIAN_CITY_CENTERS[t]) return RUSSIAN_CITY_CENTERS[t];
  const n = normalizeCityLookupKey(city);
  if (n !== t && RUSSIAN_CITY_CENTERS[n]) return RUSSIAN_CITY_CENTERS[n];
  return null;
}
