/**
 * Валидация и нормализация UUID-полей overrides перед записью в Postgres (Промт 114.4).
 */

import type { DealerOverrideField } from "./dealer-overrides-types.js";
import type { TradePointOverrideField } from "./trade-point-overrides-types.js";
import {
  DEALER_OVERRIDE_UUID_FIELDS,
  TRADE_POINT_OVERRIDE_UUID_FIELDS,
  isUuidString,
  resolvePersonaCodeToUuid,
} from "./persona-uuid-mapping.js";

export class OverridesValidationError extends Error {
  readonly code = "INVALID_UUID_FIELD";

  constructor(
    readonly field: string,
    readonly value: unknown,
  ) {
    super(`invalid input syntax for type uuid: ${String(value)}`);
    this.name = "OverridesValidationError";
  }
}

function normalizeUuidFieldValue(field: string, value: unknown): string | null {
  if (value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (isUuidString(s)) return s;
  const mapped = resolvePersonaCodeToUuid(s);
  if (mapped) return mapped;
  throw new OverridesValidationError(field, s);
}

export function sanitizeDealerOverrideUuidFields(
  patch: Partial<Record<DealerOverrideField, unknown>>,
): Partial<Record<DealerOverrideField, unknown>> {
  const out: Partial<Record<DealerOverrideField, unknown>> = { ...patch };
  for (const key of DEALER_OVERRIDE_UUID_FIELDS) {
    if (!(key in out)) continue;
    out[key] = normalizeUuidFieldValue(key, out[key]);
  }
  return out;
}

export function sanitizeTradePointOverrideUuidFields(
  patch: Partial<Record<TradePointOverrideField, unknown>>,
): Partial<Record<TradePointOverrideField, unknown>> {
  const out: Partial<Record<TradePointOverrideField, unknown>> = { ...patch };
  for (const key of TRADE_POINT_OVERRIDE_UUID_FIELDS) {
    if (!(key in out)) continue;
    out[key] = normalizeUuidFieldValue(key, out[key]);
  }
  return out;
}

export function findInvalidDealerUuidFields(
  patch: Partial<Record<DealerOverrideField, unknown>>,
): { field: string; value: string }[] {
  const invalid: { field: string; value: string }[] = [];
  for (const key of DEALER_OVERRIDE_UUID_FIELDS) {
    if (!(key in patch)) continue;
    const v = patch[key];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (!s) continue;
    if (isUuidString(s)) continue;
    if (resolvePersonaCodeToUuid(s)) continue;
    invalid.push({ field: key, value: s });
  }
  return invalid;
}
