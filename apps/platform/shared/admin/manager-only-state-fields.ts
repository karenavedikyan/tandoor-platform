/**
 * Промт 50: бизнес-правило — клиент имеет одного владельца (менеджера). Все
 * пользовательские артефакты редактирования (архив, корзина, manual-создание,
 * overrides, контакты, аудит, фото) живут ТОЛЬКО в state-слое менеджера.
 *
 * РОП / директор / админ / аналитик / маркетолог получают агрегат через
 * серверный merge нескольких scope-keys. У этих ролей собственный state-слой
 * по этим полям ДОЛЖЕН быть пустым: иначе появляются «дубликаты» архивных или
 * корзинных записей вне роли владельца.
 *
 * Этот модуль — чистая утилита, без зависимостей. Применяется симметрично:
 *   - на записи (POST /api/actualization/state) — обнуляем поля до INSERT;
 *   - на чтении (GET) — обнуляем поля у строк не-manager перед merge.
 *
 * См. также `archive-trash-invariant.ts` — INVARIANT (промт 405): dealer не может одновременно
 * быть в `dealer_overrides.trashed_at` и `state.archivedDealersById`.
 *
 * Пути выше (UI карточки, актуализация и т.п.) ничего о ней знать не должны.
 */

/**
 * 14 ключей state, которые должны существовать только у роли `manager`.
 * Ровно эти поля обнуляются у не-manager scope-keys.
 *
 * Поля UI-настроек (`dealerCardViewSettingsByUserId`, `unloadingOrderByDealerId`,
 * `routeOrderByRouteId`) — допустимы у любой роли и в этом списке НЕ участвуют.
 */
export const MANAGER_ONLY_STATE_FIELDS = [
  "archivedDealersById",
  "archivedTradePointsById",
  "archivedLegalEntitiesById",
  "trashedDealersById",
  "trashedTradePointsById",
  "manuallyCreatedDealersById",
  "manuallyCreatedTradePointsById",
  "dealerOverridesById",
  "tradePointOverridesById",
  "legalEntityOverridesByDealerId",
  "dealerActualizationContactsById",
  "dealerActualizationAuditByDealerId",
  "dealerPhotosByDealerId",
  "tradePointPhotosByTradePointId",
] as const;

export type ManagerOnlyStateField = (typeof MANAGER_ONLY_STATE_FIELDS)[number];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Возвращает копию `state`, в которой все 14 manager-only полей заменены на `{}`.
 * Не мутирует входной объект. Если переданное значение не объект — возвращает как есть.
 */
export function sanitizeStateForNonManagerRole<T>(state: T): T {
  if (!isPlainObject(state)) return state;
  const next: Record<string, unknown> = { ...state };
  for (const key of MANAGER_ONLY_STATE_FIELDS) {
    next[key] = {};
  }
  return next as T;
}

/**
 * `true` — для всех канонических ролей, кроме `manager`. Под санитизацию
 * попадают admin, director, rop, analyst, marketer, unknown.
 *
 * Аргумент — уже канонизированная роль (через `canonicalizeRole`).
 */
export function shouldSanitizeStateForRole(canonicalRole: string): boolean {
  return (canonicalRole ?? "").trim().toLowerCase() !== "manager";
}
