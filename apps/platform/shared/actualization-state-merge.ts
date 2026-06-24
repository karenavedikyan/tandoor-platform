/**
 * Серверный merge нескольких ActualizationState-снимков (GET /api/actualization/state).
 * Last-write-wins на уровне каждой записи в map-полях по rec.updatedAt с фолбэком на state.updatedAt.
 */

export const ACTUALIZATION_STATE_MAP_FIELDS = [
  "clientCategoryOverridesById",
  "dealerOverridesById",
  "manuallyCreatedDealersById",
  "tradePointOverridesById",
  "manuallyCreatedTradePointsById",
  "archivedLegalEntitiesById",
  "legalEntityOverridesByDealerId",
  "dealerCardViewSettingsByUserId",
  "dealerActualizationContactsById",
  "archivedDealerContactsById",
  "tradePointShowcaseActualizationById",
  "dealerActualizationAuditByDealerId",
  "unloadingOrderByDealerId",
  "routeOrderByRouteId",
  "dealerPhotosByDealerId",
  "tradePointPhotosByTradePointId",
  "trashedDealersById",
  "trashedTradePointsById",
] as const;

export type ActualizationStateMapField = (typeof ACTUALIZATION_STATE_MAP_FIELDS)[number];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

export function isoMs(iso: unknown): number {
  if (typeof iso !== "string" || !iso) return Number.NEGATIVE_INFINITY;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

/** Эффективное время записи: rec.updatedAt → state.updatedAt → древнейшая. */
export function recordRecencyMs(rec: unknown, stateFallbackUpdatedAt: unknown): number {
  if (isPlainObject(rec)) {
    const own = isoMs(rec.updatedAt);
    if (own !== Number.NEGATIVE_INFINITY) return own;
  }
  return isoMs(stateFallbackUpdatedAt);
}

export function emptyActualizationState(): Record<string, unknown> {
  const base: Record<string, unknown> = {
    version: 1,
    updatedAt: null,
    updatedBy: null,
  };
  for (const field of ACTUALIZATION_STATE_MAP_FIELDS) {
    base[field] = {};
  }
  return base;
}

/**
 * Объединяет state-снимки: для каждого id в map-полях остаётся запись с максимальным effective updatedAt.
 * При равном времени побеждает уже лежащая в результате (детерминизм, не зависит от порядка scope).
 */
export function mergeActualizationStates(states: Record<string, unknown>[]): Record<string, unknown> {
  const result = emptyActualizationState();
  let maxUpdatedAt: string | null = null;

  for (const state of states) {
    const updatedAt = state.updatedAt;
    if (typeof updatedAt === "string" && (!maxUpdatedAt || updatedAt > maxUpdatedAt)) {
      maxUpdatedAt = updatedAt;
    }
  }

  result.updatedAt = maxUpdatedAt;
  result.updatedBy = typeof states[0]?.updatedBy === "string" ? states[0].updatedBy : null;

  const effectiveMsByField = new Map<string, Map<string, number>>();

  function msMapFor(field: string): Map<string, number> {
    let m = effectiveMsByField.get(field);
    if (!m) {
      m = new Map();
      effectiveMsByField.set(field, m);
    }
    return m;
  }

  for (const field of ACTUALIZATION_STATE_MAP_FIELDS) {
    const target = result[field];
    if (!isPlainObject(target)) continue;
    const msMap = msMapFor(field);

    for (const state of states) {
      const value = state[field];
      if (!isPlainObject(value)) continue;
      const stateFallback = state.updatedAt;

      for (const id of Object.keys(value)) {
        const rec = value[id];
        const recMs = recordRecencyMs(rec, stateFallback);
        const prevMs = msMap.get(id);

        if (prevMs === undefined) {
          target[id] = rec;
          msMap.set(id, recMs);
          continue;
        }
        if (recMs > prevMs) {
          target[id] = rec;
          msMap.set(id, recMs);
        }
      }
    }
  }

  return result;
}

/**
 * Канонический набор записей по всем снимкам (для дедуп-скрипта).
 * Возвращает field → id → { rec, effectiveMs }.
 */
export function buildCanonicalActualizationRecords(
  states: Array<{ state: Record<string, unknown>; scopeKey?: string }>,
): Map<string, Map<string, { rec: unknown; effectiveMs: number }>> {
  const canonical = new Map<string, Map<string, { rec: unknown; effectiveMs: number }>>();

  for (const { state } of states) {
    for (const field of ACTUALIZATION_STATE_MAP_FIELDS) {
      const value = state[field];
      if (!isPlainObject(value)) continue;
      let fieldMap = canonical.get(field);
      if (!fieldMap) {
        fieldMap = new Map();
        canonical.set(field, fieldMap);
      }
      const stateFallback = state.updatedAt;
      for (const id of Object.keys(value)) {
        const rec = value[id];
        const recMs = recordRecencyMs(rec, stateFallback);
        const prev = fieldMap.get(id);
        if (!prev || recMs > prev.effectiveMs) {
          fieldMap.set(id, { rec, effectiveMs: recMs });
        }
      }
    }
  }

  return canonical;
}
