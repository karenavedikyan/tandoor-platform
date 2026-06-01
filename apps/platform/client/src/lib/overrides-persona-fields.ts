/**
 * Клиентская нормализация persona-кодов → UUID перед strict-сейвом overrides (Промт 114.4).
 */

import { MGR_TO_UUID_FOR_ACTUALIZATION_DEDUPE } from "@shared/admin/actualization-dedupe";
import type { DealerOverrideField } from "../../../shared/dealer-overrides-types";
import type { TradePointOverrideField } from "../../../shared/trade-point-overrides-types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PERSONA_CODE_TO_UUID: Record<string, string> = {
  ...MGR_TO_UUID_FOR_ACTUALIZATION_DEDUPE,
};

function isUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

function resolvePersonaUuid(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  if (isUuid(trimmed)) return trimmed;
  return PERSONA_CODE_TO_UUID[trimmed] ?? null;
}

function sanitizeUuidIdFields<T extends string>(
  fields: Partial<Record<T, unknown>>,
  idFieldNames: readonly T[],
): Partial<Record<T, unknown>> {
  const out: Partial<Record<T, unknown>> = { ...fields };
  for (const key of idFieldNames) {
    if (!(key in out)) continue;
    const raw = out[key];
    if (raw === null || raw === undefined) continue;
    const s = String(raw).trim();
    if (!s) {
      out[key] = null;
      continue;
    }
    if (isUuid(s)) {
      out[key] = s;
      continue;
    }
    const mapped = resolvePersonaUuid(s);
    if (mapped) {
      out[key] = mapped;
      continue;
    }
    console.warn("[overrides] cannot map persona code", s, { field: key });
    delete out[key];
  }
  return out;
}

export function sanitizeDealerOverrideFieldsForApi(
  fields: Partial<Record<DealerOverrideField, unknown>>,
): Partial<Record<DealerOverrideField, unknown>> {
  return sanitizeUuidIdFields(fields, ["regional_manager_id", "rop_id", "trashed_by"] as const);
}

export function sanitizeTradePointOverrideFieldsForApi(
  fields: Partial<Record<TradePointOverrideField, unknown>>,
): Partial<Record<TradePointOverrideField, unknown>> {
  return sanitizeUuidIdFields(fields, ["rop_id", "regional_manager_id", "trashed_by"] as const);
}
