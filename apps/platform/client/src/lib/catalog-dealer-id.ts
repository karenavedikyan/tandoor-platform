export function normalizeDealerIdForCatalog(raw: string): string {
  const n = parseInt(raw.trim(), 10);
  if (Number.isFinite(n) && n >= 1 && n <= 999) {
    return String(n).padStart(3, "0");
  }
  return raw.trim();
}
