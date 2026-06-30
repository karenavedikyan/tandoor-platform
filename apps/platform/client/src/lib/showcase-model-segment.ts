import type { ShowcasePlacementSegment } from "./showcase-matrix-api.js";
import {
  SHOWCASE_MATRIX_MODEL_DEFINITIONS,
} from "./trade-point-showcase-matrix-models.js";

function segmentFromIdPrefix(targetId: string): ShowcasePlacementSegment | null {
  if (targetId.startsWith("tc-vh-")) return "vh";
  if (targetId.startsWith("tc-mk-")) return "mk";
  if (targetId.startsWith("tc-hw-")) return "hardware";
  return null;
}

function segmentFromMatrixDefinitionType(
  type: "entrance" | "interior" | "hardware",
): ShowcasePlacementSegment {
  if (type === "entrance") return "vh";
  if (type === "hardware") return "hardware";
  return "mk";
}

/** Сегмент размещения модели: префикс id → seed-матрица (8 моделей). */
export function segmentForModelTargetId(targetId: string): ShowcasePlacementSegment | null {
  const id = targetId.trim();
  if (!id) return null;

  const fromPrefix = segmentFromIdPrefix(id);
  if (fromPrefix) return fromPrefix;

  const def = SHOWCASE_MATRIX_MODEL_DEFINITIONS.find((m) => m.id === id);
  if (def) return segmentFromMatrixDefinitionType(def.type);

  return null;
}
