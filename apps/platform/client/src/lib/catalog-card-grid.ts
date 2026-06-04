/** Сетки карточек каталога (как в `catalog.tsx`), переиспользуются в полноэкранном вводе витрины. */

export type CatalogCardSize = "xl" | "m" | "s" | "list";

export const CATALOG_CARD_GRID_CLASS: Record<Exclude<CatalogCardSize, "list">, string> = {
  xl: "grid grid-cols-1 gap-5 min-[650px]:grid-cols-2 min-[866px]:grid-cols-3",
  m: "grid grid-cols-2 gap-3 min-[650px]:grid-cols-3 min-[866px]:grid-cols-4 min-[866px]:gap-4",
  s: "grid grid-cols-2 gap-2 min-[650px]:grid-cols-4 min-[866px]:grid-cols-6 min-[866px]:gap-3",
};

export function catalogCardGridClass(size: CatalogCardSize): string {
  if (size === "list") {
    return "flex flex-col gap-2";
  }
  return CATALOG_CARD_GRID_CLASS[size];
}

export function readCatalogCardSizeFromStorage(storageKey: string, fallback: CatalogCardSize = "m"): CatalogCardSize {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(storageKey);
    if (v === "xl" || v === "m" || v === "s" || v === "list") return v;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function writeCatalogCardSizeToStorage(storageKey: string, size: CatalogCardSize): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, size);
  } catch {
    /* ignore */
  }
}
