const CATALOG_1C_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UUID товара каталога 1С (не legacy seed-id вида tc-…). */
export function isCatalog1cProductId(id: string | null | undefined): boolean {
  const trimmed = id?.trim();
  return Boolean(trimmed && CATALOG_1C_UUID_RE.test(trimmed));
}

export function catalog1cProductHref(catalogId: string | null | undefined): string | null {
  if (!isCatalog1cProductId(catalogId)) return null;
  return `/catalog/1c/${catalogId!.trim()}`;
}
