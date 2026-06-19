/**
 * Промт 433: версия формы данных, которые мы храним в localStorage.
 *
 * Bump при ЛЮБОМ из следующих изменений:
 *  - изменилась структура roleScopedDealerRows / actualization snap-ов
 *  - переименован/удалён ключ, который читается без миграции
 *  - изменился контракт между UI и snap (как было с RoleScope в промте 431)
 *
 * Не bump-ить ради косметики или новой колонки, которую старый код просто игнорирует.
 */
export const SCHEMA_VERSION = 1 as const;

/**
 * Ключ, в котором клиент хранит последнюю увиденную SCHEMA_VERSION.
 */
export const SCHEMA_VERSION_STORAGE_KEY = "tandoor-schema-version" as const;

/**
 * Префиксы и точные ключи, которые сносим при mismatch.
 * Cookies, session-id и прочая HttpOnly авторизация НЕ задеваются (мы трогаем только localStorage).
 */
export const WIPE_PREFIXES: readonly string[] = [
  "tandoor-",
  "tandoor:",
  "actualization-",
  "dealer-base-",
  "trade-points-",
  "roleScope",
  "roleScopedDealerRows",
] as const;

/**
 * Ключи, которые НЕ удаляем даже при wipe — мягкие настройки UX,
 * которые безопасны для любой версии (язык, тема и т.п. — если появятся).
 */
export const WIPE_KEEP_KEYS: ReadonlySet<string> = new Set<string>([
  // оставляем сам маркер версии — он перезапишется ниже
  "tandoor-schema-version",
]);
