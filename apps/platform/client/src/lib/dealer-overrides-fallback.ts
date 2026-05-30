/**
 * Временный fallback чтения из actualization blob (Промт 113, 14 дней).
 */

/** После этой даты blob-ветки category/trash не читаются. */
export const PROMPT_113_BLOB_FALLBACK_EXPIRES_AT_MS = Date.parse("2026-06-14T00:00:00.000Z");

export function isPrompt113BlobFallbackActive(): boolean {
  return Date.now() < PROMPT_113_BLOB_FALLBACK_EXPIRES_AT_MS;
}
