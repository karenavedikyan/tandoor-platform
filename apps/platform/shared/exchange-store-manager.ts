/**
 * Materialized 1C manager UUID for a trade point — same field as `manager_1c` on /1c/store/:id.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function materializedStoreManagerUuid(
  manager1c: string | null | undefined,
): string | null {
  const v = String(manager1c ?? "").trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  return UUID_RE.test(lower) ? lower : null;
}
