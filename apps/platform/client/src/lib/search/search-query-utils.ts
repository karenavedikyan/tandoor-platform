/** Минимальная длина запроса для контентного поиска. */
export const GLOBAL_SEARCH_MIN_QUERY_LEN = 2;

export const GLOBAL_SEARCH_LIMIT_PER_TYPE = 8;

export function normalizeSearchHaystack(parts: (string | null | undefined)[]): string {
  return parts
    .filter((x) => x != null && String(x).trim() !== "")
    .map((x) => String(x).toLowerCase())
    .join(" ");
}

/** Нечувствительный к регистру поиск по нескольким ключевым словам (AND). */
export function multiWordSearchMatches(haystack: string, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return true;
  return parts.every((p) => haystack.includes(p));
}

export function isContentSearchQuery(rawQuery: string): boolean {
  return rawQuery.trim().length >= GLOBAL_SEARCH_MIN_QUERY_LEN;
}

export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}
