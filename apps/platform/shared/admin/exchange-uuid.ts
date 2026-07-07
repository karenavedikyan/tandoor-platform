/**
 * Shared UUID normalization for 1C exchange XML parsers.
 */

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normUuid(value: string | undefined | null): string | null {
  const v = String(value ?? "").trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  return UUID_RE.test(lower) ? lower : null;
}

export function normText(value: string | undefined | null): string {
  return String(value ?? "").trim();
}

export function normPhone(value: string | undefined | null): string | null {
  const v = normText(value);
  if (!v) return null;
  const cleaned = v.replace(/[^\d+]/g, "");
  return cleaned || null;
}

export function parseOptionalFloat(value: string | undefined | null): number | null {
  const v = normText(value);
  if (!v) return null;
  const n = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
