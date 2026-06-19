/**
 * Defensive merge для state.client_base_actualization_state.
 *
 * При stale POST'е (клиент прислал старый снапшот) мы не должны затирать
 * записи, которые есть в prevState, но отсутствуют в nextState. Делаем union
 * по ключам для всех manager-only "id-словарей".
 *
 * Поля, защищаемые этим merge'ом (помимо trashed*, которые уже защищены
 * applyTrashProtection):
 */

export const MANAGER_ID_DICT_FIELDS = [
  "archivedLegalEntitiesById",
  "archivedDealerContactsById",
  "dealerOverridesById",
  "manuallyCreatedDealersById",
  "tradePointOverridesById",
  "manuallyCreatedTradePointsById",
  "legalEntityOverridesByDealerId",
  "dealerActualizationContactsById",
  "dealerActualizationAuditByDealerId",
  "unloadingOrderByDealerId",
  "dealerPhotosByDealerId",
  "tradePointPhotosByTradePointId",
  "tradePointShowcaseActualizationById",
] as const;

export type StaleMergeResult = {
  state: Record<string, unknown>;
  /** Сколько ключей было восстановлено из prevState по каждому полю. */
  recoveredByField: Record<string, number>;
  /** Суммарно восстановлено ключей. */
  totalRecovered: number;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function pickRecord(host: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> {
  if (!isPlainObject(host)) return {};
  const v = host[key];
  return isPlainObject(v) ? v : {};
}

function ensureRecord(host: Record<string, unknown>, key: string): Record<string, unknown> {
  const cur = host[key];
  if (isPlainObject(cur)) return cur;
  const empty: Record<string, unknown> = {};
  host[key] = empty;
  return empty;
}

export function isStaleActualizationSnapshot(
  prevState: Record<string, unknown> | null | undefined,
  incomingUpdatedAt: string | null,
): boolean {
  const prevUpdatedAt =
    isPlainObject(prevState) && typeof prevState.updatedAt === "string" ? prevState.updatedAt : null;
  return (
    prevUpdatedAt != null &&
    incomingUpdatedAt != null &&
    incomingUpdatedAt < prevUpdatedAt
  );
}

/**
 * Объединяет prevState и nextState по правилу: если ключ есть в prev,
 * но отсутствует в next — переносим запись из prev в next. Существующие
 * записи в next не трогаем (клиент мог легитимно их изменить).
 *
 * Активируется ТОЛЬКО при stale POST (incoming.updatedAt < prev.updatedAt).
 * При свежем POST'е merge не нужен — клиент явно знает, что удаляет.
 */
export function applyStaleStateMerge(
  prevState: Record<string, unknown> | null | undefined,
  nextState: Record<string, unknown>,
): StaleMergeResult {
  const recoveredByField: Record<string, number> = {};
  let totalRecovered = 0;

  if (!isPlainObject(prevState)) {
    return { state: nextState, recoveredByField, totalRecovered: 0 };
  }

  for (const field of MANAGER_ID_DICT_FIELDS) {
    const prevDict = pickRecord(prevState, field);
    const nextDict = ensureRecord(nextState, field);
    let count = 0;
    for (const key of Object.keys(prevDict)) {
      if (key in nextDict) continue;
      nextDict[key] = prevDict[key];
      count += 1;
    }
    if (count > 0) recoveredByField[field] = count;
    totalRecovered += count;
  }

  return { state: nextState, recoveredByField, totalRecovered };
}
