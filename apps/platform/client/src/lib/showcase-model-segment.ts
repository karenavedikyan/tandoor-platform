import type { ShowcasePlacementSegment } from "./showcase-matrix-api.js";
import { TANDOOR_REAL_CATALOG_SEED } from "./tandoor-real-catalog-seed.generated.js";
import {
  SHOWCASE_MATRIX_MODEL_DEFINITIONS,
} from "./trade-point-showcase-matrix-models.js";

const CATALOG_BY_ID = new Map(TANDOOR_REAL_CATALOG_SEED.map((p) => [p.id, p]));

function categoryToSegment(
  category: "entrance" | "interior" | "hardware" | "other",
): ShowcasePlacementSegment | null {
  if (category === "entrance") return "vh";
  if (category === "interior") return "mk";
  if (category === "hardware") return "hardware";
  return null;
}

function segmentFromIdPrefix(targetId: string): ShowcasePlacementSegment | null {
  if (targetId.startsWith("tc-vh-")) return "vh";
  if (targetId.startsWith("tc-mk-")) return "mk";
  if (targetId.startsWith("tc-hw-")) return "hardware";
  return null;
}

/** Сегмент размещения модели: каталог 1С → префикс id → seed-матрица. */
export function segmentForModelTargetId(targetId: string): ShowcasePlacementSegment | null {
  const id = targetId.trim();
  if (!id) return null;

  const catalogItem = CATALOG_BY_ID.get(id);
  if (catalogItem) {
    const fromCatalog = categoryToSegment(catalogItem.category);
    if (fromCatalog) return fromCatalog;
  }

  const fromPrefix = segmentFromIdPrefix(id);
  if (fromPrefix) return fromPrefix;

  const def = SHOWCASE_MATRIX_MODEL_DEFINITIONS.find((m) => m.id === id);
  if (def) {
    if (def.type === "entrance") return "vh";
    if (def.type === "interior") return "mk";
    if (def.type === "hardware") return "hardware";
  }

  return null;
}
