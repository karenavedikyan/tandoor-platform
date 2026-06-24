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
