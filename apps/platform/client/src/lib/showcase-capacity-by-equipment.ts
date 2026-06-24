import type {
  ShowcaseMatrixEntryDto,
  ShowcasePlacementSegment,
  ShowcasePlacementType,
} from "./showcase-matrix-api.js";
import { allowedTypesForSegment } from "./showcase-placement-labels.js";
import { setMatrixPlacement, loadCachedPlacements } from "./showcase-matrix-store.js";

export type EquipmentTypeCapacityRow = {
  placementType: ShowcasePlacementType;
  capacity: number;
  blockTargetId: string | null;
  placementActual: number;
};

export type EquipmentCapacityBySegment = Record<ShowcasePlacementSegment, EquipmentTypeCapacityRow[]>;

export type CategoryCapacityFromPlacements = {
  entrance: number;
  interior: number;
  hardware: number;
};

const SEGMENTS: ShowcasePlacementSegment[] = ["vh", "mk", "hardware"];

function placementBlocks(placements: ShowcaseMatrixEntryDto[]): ShowcaseMatrixEntryDto[] {
  return placements.filter((e) => e.targetKind === "placement");
}

export function capacityByEquipmentType(placements: ShowcaseMatrixEntryDto[]): EquipmentCapacityBySegment {
  const acc: Record<
    ShowcasePlacementSegment,
    Map<
      ShowcasePlacementType,
      { capacity: number; blockTargetId: string | null; placementActual: number }
    >
  > = {
    vh: new Map(),
    mk: new Map(),
    hardware: new Map(),
  };

  for (const block of placementBlocks(placements)) {
    const seg = block.placementSegment;
    const type = block.placementType;
    if (!seg || !type) continue;
    const cap = Math.max(0, block.placementCapacity ?? 0);
    const actual = Math.max(0, block.placementActual ?? 0);
    const prev = acc[seg].get(type);
    if (prev) {
      acc[seg].set(type, {
        capacity: prev.capacity + cap,
        blockTargetId: prev.blockTargetId ?? block.targetId,
        placementActual: prev.placementActual + actual,
      });
    } else {
      acc[seg].set(type, { capacity: cap, blockTargetId: block.targetId, placementActual: actual });
    }
  }

  const result: EquipmentCapacityBySegment = { vh: [], mk: [], hardware: [] };
  for (const segment of SEGMENTS) {
    for (const placementType of allowedTypesForSegment(segment)) {
      const row = acc[segment].get(placementType);
      result[segment].push({
        placementType,
        capacity: row?.capacity ?? 0,
        blockTargetId: row?.blockTargetId ?? null,
        placementActual: row?.placementActual ?? 0,
      });
    }
  }
  return result;
}

export function categoryCapacityFromPlacements(
  placements: ShowcaseMatrixEntryDto[],
): CategoryCapacityFromPlacements {
  let entrance = 0;
  let interior = 0;
  let hardware = 0;
  for (const block of placementBlocks(placements)) {
    const cap = Math.max(0, block.placementCapacity ?? 0);
    if (block.placementSegment === "vh") entrance += cap;
    else if (block.placementSegment === "mk") interior += cap;
    else if (block.placementSegment === "hardware") hardware += cap;
  }
  return { entrance, interior, hardware };
}

export function equipmentCapacityKey(
  segment: ShowcasePlacementSegment,
  placementType: ShowcasePlacementType,
): string {
  return `${segment}:${placementType}`;
}

export function parseEquipmentCapacityKey(
  key: string,
): { segment: ShowcasePlacementSegment; placementType: ShowcasePlacementType } | null {
  const [segment, placementType] = key.split(":") as [ShowcasePlacementSegment, ShowcasePlacementType];
  if (!SEGMENTS.includes(segment) || !placementType) return null;
  return { segment, placementType };
}

export function newEquipmentBlockTargetId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `placement-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export type EquipmentCapacityInput = Record<string, number>;

export const LEGACY_FALLBACK_TYPE_BY_SEGMENT: Record<ShowcasePlacementSegment, ShowcasePlacementType> = {
  vh: "unmounted",
  mk: "unmounted",
  hardware: "branded_stand",
};

export function legacyCategoryCapacityFromRec(
  rec:
    | {
        entrancePortals?: number | null;
        interiorPortals?: number | null;
        hardwareSections?: number | null;
      }
    | undefined,
): CategoryCapacityFromPlacements {
  return {
    entrance: rec?.entrancePortals != null && rec.entrancePortals > 0 ? rec.entrancePortals : 0,
    interior: rec?.interiorPortals != null && rec.interiorPortals > 0 ? rec.interiorPortals : 0,
    hardware: rec?.hardwareSections != null && rec.hardwareSections > 0 ? rec.hardwareSections : 0,
  };
}

export function buildEquipmentCapacityInputs(
  placements: ShowcaseMatrixEntryDto[],
): EquipmentCapacityInput {
  const byType = capacityByEquipmentType(placements);
  const inputs: EquipmentCapacityInput = {};
  for (const segment of SEGMENTS) {
    for (const row of byType[segment]) {
      inputs[equipmentCapacityKey(segment, row.placementType)] = row.capacity;
    }
  }
  return inputs;
}

/** Сидирует inputs из placement-блоков; при отсутствии блоков — из legacy-категорийной ёмкости. */
export function seedInputsWithLegacyFallback(
  placements: ShowcaseMatrixEntryDto[],
  legacy: CategoryCapacityFromPlacements,
): EquipmentCapacityInput {
  const inputs = buildEquipmentCapacityInputs(placements);
  const placementCats = categoryCapacityFromPlacements(placements);

  const seedSegment = (segment: ShowcasePlacementSegment, legacyValue: number) => {
    const placementTotal =
      segment === "vh"
        ? placementCats.entrance
        : segment === "mk"
          ? placementCats.interior
          : placementCats.hardware;
    if (placementTotal > 0 || legacyValue <= 0) return;
    const type = LEGACY_FALLBACK_TYPE_BY_SEGMENT[segment];
    inputs[equipmentCapacityKey(segment, type)] = legacyValue;
  };

  seedSegment("vh", legacy.entrance);
  seedSegment("mk", legacy.interior);
  seedSegment("hardware", legacy.hardware);
  return inputs;
}

export function resolveEffectiveCategoryTotals(
  placements: ShowcaseMatrixEntryDto[],
  legacy: CategoryCapacityFromPlacements,
): CategoryCapacityFromPlacements {
  const fromPlacements = categoryCapacityFromPlacements(placements);
  return {
    entrance: fromPlacements.entrance > 0 ? fromPlacements.entrance : legacy.entrance,
    interior: fromPlacements.interior > 0 ? fromPlacements.interior : legacy.interior,
    hardware: fromPlacements.hardware > 0 ? fromPlacements.hardware : legacy.hardware,
  };
}

/** Нулевое значение из диалога не затирает существующую legacy-ёмкость. */
export function mergeCategoryCapacityPreservingLegacy(
  next: CategoryCapacityFromPlacements,
  prev: CategoryCapacityFromPlacements,
): CategoryCapacityFromPlacements {
  const pick = (n: number, p: number) => (n > 0 ? n : p > 0 ? p : 0);
  return {
    entrance: pick(next.entrance, prev.entrance),
    interior: pick(next.interior, prev.interior),
    hardware: pick(next.hardware, prev.hardware),
  };
}

export function categoryCapacityFieldsForPersist(params: {
  next: CategoryCapacityFromPlacements;
  prevRec: {
    entrancePortals?: number | null;
    interiorPortals?: number | null;
    hardwareSections?: number | null;
  };
  hasShowcase: boolean;
}): {
  entrancePortals: number | null;
  interiorPortals: number | null;
  hardwareSections: number | null;
} {
  if (!params.hasShowcase) {
    return { entrancePortals: null, interiorPortals: null, hardwareSections: null };
  }
  return {
    entrancePortals:
      params.next.entrance > 0 ? params.next.entrance : (params.prevRec.entrancePortals ?? null),
    interiorPortals:
      params.next.interior > 0 ? params.next.interior : (params.prevRec.interiorPortals ?? null),
    hardwareSections:
      params.next.hardware > 0 ? params.next.hardware : (params.prevRec.hardwareSections ?? null),
  };
}

export function persistEquipmentCapacityInputs(params: {
  dealerId: string;
  tradePointId: string;
  placements: ShowcaseMatrixEntryDto[];
  inputs: EquipmentCapacityInput;
  updatedBy: string;
  updatedByName: string;
}): CategoryCapacityFromPlacements {
  const { dealerId, tradePointId, placements, inputs, updatedBy, updatedByName } = params;
  const blocks = placementBlocks(placements);

  for (const segment of SEGMENTS) {
    for (const placementType of allowedTypesForSegment(segment)) {
      const key = equipmentCapacityKey(segment, placementType);
      const nextCapacity = Math.max(0, Math.floor(inputs[key] ?? 0));
      const matching = blocks.filter(
        (b) => b.placementSegment === segment && b.placementType === placementType,
      );
      const prevCapacity = matching.reduce((sum, b) => sum + Math.max(0, b.placementCapacity ?? 0), 0);
      const prevActual = matching.reduce((sum, b) => sum + Math.max(0, b.placementActual ?? 0), 0);

      if (matching.length === 0) {
        if (nextCapacity <= 0) continue;
        setMatrixPlacement({
          dealerId,
          tradePointId,
          targetId: newEquipmentBlockTargetId(),
          placementType,
          placementSegment: segment,
          placementCapacity: nextCapacity,
          placementActual: 0,
          updatedBy,
          updatedByName,
          comment: null,
        });
        continue;
      }

      const primary = matching[0]!;
      const capacityComment =
        prevCapacity !== nextCapacity ? `ёмкость ${prevCapacity} → ${nextCapacity}` : null;

      setMatrixPlacement({
        dealerId,
        tradePointId,
        targetId: primary.targetId,
        placementType,
        placementSegment: segment,
        placementCapacity: nextCapacity,
        placementActual: prevActual,
        placementCompetitors: primary.placementCompetitors,
        updatedBy,
        updatedByName,
        comment: capacityComment ?? primary.comment,
      });

      for (const extra of matching.slice(1)) {
        if ((extra.placementCapacity ?? 0) === 0 && (extra.placementActual ?? 0) === 0) continue;
        setMatrixPlacement({
          dealerId,
          tradePointId,
          targetId: extra.targetId,
          placementType,
          placementSegment: segment,
          placementCapacity: 0,
          placementActual: 0,
          placementCompetitors: extra.placementCompetitors,
          updatedBy,
          updatedByName,
          comment: extra.comment,
        });
      }
    }
  }

  return categoryCapacityFromPlacements(loadCachedPlacements(tradePointId));
}
