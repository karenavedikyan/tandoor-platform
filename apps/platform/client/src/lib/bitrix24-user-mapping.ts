/**
 * Статический маппинг пользователя ЛК → bitrixUserId (MVP).
 * В production значения должны приходить из профиля на backend.
 *
 * TODO(auth-users-admin-cd7c): убрать хардкод, брать связку из `/api/users` или профиля.
 */

import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";

/** Bitrix24 user id по id пользователя из SALES_USERS. */
const BITRIX24_USER_ID_BY_SALES_USER_ID: Record<string, string> = {
  "mgr-avedikyan-ka": "2",
  "mgr-boyko-em": "120931",
  "mgr-koteneva-av": "120829",
  "mgr-sklyarov-dv": "126087",
  "user-tl-sapozhkov": "129675",
  "user-tl-kupiansky": "100",
};

/** Дублирование по логину демо (исторически из mock-auth). */
const BITRIX24_USER_ID_BY_USERNAME: Record<string, string> = {
  avedikyan: "2",
  boyko: "120931",
  koteneva: "120829",
  "sklyarov-dv": "126087",
  sapozhkov: "129675",
  kupiansky: "100",
};

export const BITRIX24_USER_MAPPING_NOT_CONFIGURED_RU =
  "Для пользователя не настроена связка с Bitrix24";

function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function bitrixIdForSalesUserId(userId: string): string | null {
  const direct = BITRIX24_USER_ID_BY_SALES_USER_ID[userId];
  if (direct) return direct;
  return null;
}

/** Возвращает bitrixUserId для персоны демо-профиля или null, если связка не задана. */
export function getBitrix24UserIdForProfile(profile: ReleaseDemoProfile): string | null {
  return bitrixIdForSalesUserId(profile.personaUserId);
}

export function hasBitrix24UserMapping(profile: ReleaseDemoProfile): boolean {
  return getBitrix24UserIdForProfile(profile) != null;
}

/** Для админ-таблицы POC: связка по id пользователя ЛК без полного профиля. */
export function getBitrix24UserIdForSalesUserId(userId: string): string | null {
  return bitrixIdForSalesUserId(userId);
}

/** Резервный поиск по username (пилот). */
export function getBitrix24UserIdForUsername(username: string): string | null {
  return BITRIX24_USER_ID_BY_USERNAME[normalizeUsername(username)] ?? null;
}
