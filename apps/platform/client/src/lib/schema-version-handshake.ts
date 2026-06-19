import {
  SCHEMA_VERSION,
  SCHEMA_VERSION_STORAGE_KEY,
  WIPE_PREFIXES,
  WIPE_KEEP_KEYS,
} from "./schema-version";

/**
 * Промт 433: при старте сравнить сохранённую SCHEMA_VERSION с текущей.
 * Если расходится (или её нет, а данные есть) — массово очистить tandoor-ключи
 * и сохранить новую версию. Возвращает true, если был выполнен wipe (для логов).
 *
 * Безопасно вызывать каждый старт, до рендера.
 */
export function runSchemaVersionHandshake(): { wiped: boolean; removedCount: number } {
  try {
    const stored = window.localStorage.getItem(SCHEMA_VERSION_STORAGE_KEY);
    const current = String(SCHEMA_VERSION);
    if (stored === current) {
      return { wiped: false, removedCount: 0 };
    }

    // Соберём все ключи, подпадающие под wipe.
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (WIPE_KEEP_KEYS.has(k)) continue;
      if (WIPE_PREFIXES.some((p) => k.startsWith(p))) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) {
      try {
        window.localStorage.removeItem(k);
      } catch {
        /* ignore individual key failure */
      }
    }
    window.localStorage.setItem(SCHEMA_VERSION_STORAGE_KEY, current);

    // Логируем для admin-диагностики через консоль (без алертов и тостов).
    // eslint-disable-next-line no-console
    console.info("[schema-version] handshake wipe", {
      from: stored,
      to: current,
      removedCount: toRemove.length,
    });

    return { wiped: true, removedCount: toRemove.length };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[schema-version] handshake failed", e);
    return { wiped: false, removedCount: 0 };
  }
}

/** Сбросить маркер версии — следующий старт гарантированно выполнит wipe при mismatch. */
export function clearSchemaVersionMarkerForHandshake(): void {
  try {
    window.localStorage.removeItem(SCHEMA_VERSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Перезагрузка страницы со сбросом маркера schema-version (error boundary / retry). */
export function reloadPageWithSchemaVersionBump(): void {
  clearSchemaVersionMarkerForHandshake();
  window.location.reload();
}
