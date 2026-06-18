/**
 * @deprecated Промт 397: trash/category читаются из jsonb-state безусловно.
 * Файл оставлен для истории; удалить в cleanup-PR после проверки grep.
 */

/** @deprecated Истёк 2026-06-14; больше не используется в runtime. */
export const PROMPT_113_BLOB_FALLBACK_EXPIRES_AT_MS = Date.parse("2026-06-14T00:00:00.000Z");

/** @deprecated Всегда false после Промта 397. */
export function isPrompt113BlobFallbackActive(): boolean {
  return false;
}
