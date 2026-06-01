/**
 * Маппинг legacy persona-кодов (mgr-*, user-*) → UUID пользователей ЛК (Промт 33.2 / 114.4).
 */

import { MGR_TO_UUID_FOR_ACTUALIZATION_DEDUPE } from "./admin/actualization-dedupe.js";

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidString(value: unknown): boolean {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

/** Поля overrides дилера, хранящиеся в Postgres как UUID. */
export const DEALER_OVERRIDE_UUID_FIELDS = ["regional_manager_id", "rop_id", "trashed_by"] as const;

export type DealerOverrideUuidField = (typeof DEALER_OVERRIDE_UUID_FIELDS)[number];

/** Поля overrides ТТ с типом UUID в БД. */
export const TRADE_POINT_OVERRIDE_UUID_FIELDS = [
  "rop_id",
  "regional_manager_id",
  "trashed_by",
] as const;

export type TradePointOverrideUuidField = (typeof TRADE_POINT_OVERRIDE_UUID_FIELDS)[number];

const PERSONA_CODE_TO_UUID: Record<string, string> = {
  ...MGR_TO_UUID_FOR_ACTUALIZATION_DEDUPE,
};

export function resolvePersonaCodeToUuid(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  if (isUuidString(trimmed)) return trimmed;
  return PERSONA_CODE_TO_UUID[trimmed] ?? null;
}

export function resolvePersonaUuidByCode(code: string): string | null {
  return resolvePersonaCodeToUuid(code);
}
