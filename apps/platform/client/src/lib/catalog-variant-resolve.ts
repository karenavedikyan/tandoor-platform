export type CatalogVariant = {
  product_id: string;
  size: string | null;
  color: string | null;
  door_type: string | null;
  side: string | null;
  price_retail: number | null;
  price_retail_sale: number | null;
  image_url: string | null;
  total_stock: number | null;
};

export type VariantSelection = {
  size?: string | null;
  color?: string | null;
  door_type?: string | null;
  side?: string | null;
};

const AXIS_WEIGHT: Record<keyof VariantSelection, number> = {
  size: 1000,
  door_type: 100,
  side: 50,
  color: 10,
};

const AXES: (keyof VariantSelection)[] = ["size", "door_type", "side", "color"];

export function doorTypeShortLabel(full: string): string {
  if (full.includes("ДГ")) return "ДГ";
  if (full.includes("ДЧ")) return "ДЧ";
  if (full.includes("ДО")) return "ДО";
  return full.length > 4 ? full.slice(0, 3) : full;
}

export function sideShortLabel(full: string): "L" | "R" | string {
  const n = full.trim().toLowerCase();
  if (n.startsWith("лев")) return "L";
  if (n.startsWith("прав")) return "R";
  return full;
}

function axisValue(v: CatalogVariant, key: keyof VariantSelection): string | null {
  return v[key] ?? null;
}

/** Точное совпадение → иначе максимальный score по выбранным осям → fallback. */
export function resolveCatalogVariant(
  variants: CatalogVariant[],
  selection: VariantSelection,
  fallbackProductId: string,
): CatalogVariant | null {
  if (!variants.length) return null;

  const fallback =
    variants.find((v) => v.product_id === fallbackProductId) ?? variants[0]!;

  const activeAxes = AXES.filter((k) => {
    const val = selection[k];
    return val != null && val !== "";
  });
  if (activeAxes.length === 0) return fallback;

  const exact = variants.find((v) =>
    activeAxes.every((k) => axisValue(v, k) === selection[k]),
  );
  if (exact) return exact;

  let best: CatalogVariant | null = null;
  let bestScore = -Infinity;

  for (const v of variants) {
    let score = 0;
    let hardFail = false;
    for (const k of activeAxes) {
      const sel = selection[k]!;
      const val = axisValue(v, k);
      if (val === sel) score += AXIS_WEIGHT[k];
      else {
        score -= AXIS_WEIGHT[k];
        hardFail = true;
      }
    }
    if (!hardFail && score > bestScore) {
      bestScore = score;
      best = v;
    }
  }

  if (best) return best;

  for (const v of variants) {
    let score = 0;
    for (const k of activeAxes) {
      if (axisValue(v, k) === selection[k]) score += AXIS_WEIGHT[k];
    }
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }

  return best ?? fallback;
}

export function selectionFromVariant(v: CatalogVariant): VariantSelection {
  return {
    size: v.size,
    color: v.color,
    door_type: v.door_type,
    side: v.side,
  };
}

export function isDoorTypeAvailable(
  variants: CatalogVariant[],
  doorType: string,
  selection: VariantSelection,
): boolean {
  return variants.some((v) => {
    if (v.door_type !== doorType) return false;
    if (selection.size && v.size !== selection.size) return false;
    if (selection.color && v.color !== selection.color) return false;
    if (selection.side && v.side !== selection.side) return false;
    return true;
  });
}

export function isSideAvailable(
  variants: CatalogVariant[],
  side: string,
  selection: VariantSelection,
): boolean {
  return variants.some((v) => {
    if (v.side !== side) return false;
    if (selection.size && v.size !== selection.size) return false;
    if (selection.color && v.color !== selection.color) return false;
    if (selection.door_type && v.door_type !== selection.door_type) return false;
    return true;
  });
}
