/**
 * Чистые утилиты для работы с корзиной актуализации:
 *
 * - `applyTrashProtection` — защита от случайной потери записи корзины при POST
 *   старого state (без явного флага `unTrash`). Используется и сервером, и тестами.
 * - `purgeExpiredTrash` — отсекает записи с истёкшим `expiresAt`. Используется cron'ом.
 *
 * Файл намеренно self-contained: никаких импортов client/, server/, schema. Только plain
 * JS типы. Это позволяет вызывать его из Vercel-функций без bundling client-кода.
 */

export type UnTrashDirective = {
  dealers?: string[];
  tradePoints?: string[];
};

export type TrashProtectionResult = {
  /** Сколько ключей корзины-клиентов восстановлено из prev (без unTrash). */
  protectedDealers: number;
  /** Сколько ключей корзины-ТТ восстановлено из prev. */
  protectedTradePoints: number;
  /** Готовый state с восстановленными ключами. Мутирует переданный `nextState`. */
  state: Record<string, unknown>;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function ensureRecord(host: Record<string, unknown>, key: string): Record<string, unknown> {
  const cur = host[key];
  if (isPlainObject(cur)) return cur;
  const empty: Record<string, unknown> = {};
  host[key] = empty;
  return empty;
}

function pickRecord(host: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> {
  if (!isPlainObject(host)) return {};
  const v = host[key];
  return isPlainObject(v) ? v : {};
}

/**
 * Восстанавливает в `nextState` записи корзины, которых нет в `nextState`,
 * но которые ЕСТЬ в `prevState`, при условии что они НЕ перечислены в `unTrash`.
 * Это защищает корзину от стирания старым POST'ом (race, оффлайн merge и т.п.).
 */
export function applyTrashProtection(
  prevState: Record<string, unknown> | null | undefined,
  nextState: Record<string, unknown>,
  unTrash: UnTrashDirective | null | undefined,
): TrashProtectionResult {
  const unTrashDealers = new Set<string>(
    Array.isArray(unTrash?.dealers) ? unTrash!.dealers!.filter((x): x is string => typeof x === "string") : [],
  );
  const unTrashTps = new Set<string>(
    Array.isArray(unTrash?.tradePoints) ? unTrash!.tradePoints!.filter((x): x is string => typeof x === "string") : [],
  );

  const prevDealers = pickRecord(prevState, "trashedDealersById");
  const prevTps = pickRecord(prevState, "trashedTradePointsById");

  const nextDealers = ensureRecord(nextState, "trashedDealersById");
  const nextTps = ensureRecord(nextState, "trashedTradePointsById");

  let protectedDealers = 0;
  let protectedTradePoints = 0;

  for (const key of Object.keys(prevDealers)) {
    if (key in nextDealers) continue;
    if (unTrashDealers.has(key)) continue;
    nextDealers[key] = prevDealers[key];
    protectedDealers += 1;
  }
  for (const key of Object.keys(prevTps)) {
    if (key in nextTps) continue;
    if (unTrashTps.has(key)) continue;
    nextTps[key] = prevTps[key];
    protectedTradePoints += 1;
  }

  return { protectedDealers, protectedTradePoints, state: nextState };
}

export type PurgeTrashResult = {
  /** Сколько записей корзины-клиентов удалено. */
  purgedDealers: number;
  /** Сколько записей корзины-ТТ удалено. */
  purgedTradePoints: number;
  /** Был ли state изменён. */
  changed: boolean;
  /** Готовый state с удалёнными просроченными записями. Мутирует входной объект. */
  state: Record<string, unknown>;
};

/**
 * Удаляет из `trashedDealersById` / `trashedTradePointsById` записи, у которых
 * `expiresAt` ≤ переданному моменту. Возвращает счётчики и флаг изменения.
 */
export function purgeExpiredTrash(state: Record<string, unknown>, nowMs: number): PurgeTrashResult {
  const dealers = ensureRecord(state, "trashedDealersById");
  const tps = ensureRecord(state, "trashedTradePointsById");

  let purgedDealers = 0;
  let purgedTradePoints = 0;

  for (const [key, value] of Object.entries(dealers)) {
    const expIso = isPlainObject(value) && typeof value.expiresAt === "string" ? value.expiresAt : null;
    if (!expIso) continue;
    const expMs = Date.parse(expIso);
    if (!Number.isFinite(expMs)) continue;
    if (expMs <= nowMs) {
      delete dealers[key];
      purgedDealers += 1;
    }
  }
  for (const [key, value] of Object.entries(tps)) {
    const expIso = isPlainObject(value) && typeof value.expiresAt === "string" ? value.expiresAt : null;
    if (!expIso) continue;
    const expMs = Date.parse(expIso);
    if (!Number.isFinite(expMs)) continue;
    if (expMs <= nowMs) {
      delete tps[key];
      purgedTradePoints += 1;
    }
  }

  const changed = purgedDealers > 0 || purgedTradePoints > 0;
  return { purgedDealers, purgedTradePoints, changed, state };
}
