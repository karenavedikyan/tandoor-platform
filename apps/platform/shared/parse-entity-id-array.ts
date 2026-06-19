/** Parse a string[] entity id field from JSON request bodies (bulk trash/restore actions). */
export function parseEntityIdArray(body: unknown, field: string): string[] {
  const raw = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>)[field] : null;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
