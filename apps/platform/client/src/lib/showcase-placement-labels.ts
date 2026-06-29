import type { ShowcasePlacementSegment, ShowcasePlacementType } from "./showcase-matrix-api.js";

export const PLACEMENT_TYPE_LABEL_RU: Record<ShowcasePlacementType, string> = {
  portal: "Портал",
  cube: "Куб",
  book: "Книжка",
  hoof: "Копытца",
  unmounted: "Без крепления",
  branded_stand: "Фирменный стенд",
  stream_sku: "Ручеёк (SKU)",
  portal_second: "2-й план",
};

export const PLACEMENT_SEGMENT_LABEL_RU: Record<ShowcasePlacementSegment, string> = {
  vh: "ВХ двери",
  mk: "МК двери",
  hardware: "Фурнитура",
};

export const PLACEMENT_QUALITY_WEIGHT: Record<ShowcasePlacementType, number> = {
  portal: 1.0,
  cube: 0.8,
  book: 0.7,
  hoof: 0.5,
  unmounted: 0.2,
  branded_stand: 1.0,
  stream_sku: 0.6,
  portal_second: 1.0,
};

export const DOOR_PLACEMENT_TYPES: ShowcasePlacementType[] = [
  "portal",
  "cube",
  "book",
  "hoof",
  "unmounted",
  "portal_second",
];
export const HARDWARE_PLACEMENT_TYPES: ShowcasePlacementType[] = ["branded_stand", "stream_sku"];

export function allowedTypesForSegment(segment: ShowcasePlacementSegment): ShowcasePlacementType[] {
  if (segment === "hardware") return HARDWARE_PLACEMENT_TYPES;
  if (segment === "mk") return ["portal", "portal_second", "cube", "book", "hoof", "unmounted"];
  return ["portal", "cube", "book", "hoof", "unmounted"];
}
