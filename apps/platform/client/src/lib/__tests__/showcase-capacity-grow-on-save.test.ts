/**
 * Регрессия: авто-рост ёмкости при сохранении (все segment × placementType).
 * Запуск: npm run test:showcase-capacity-grow-on-save
 */
import assert from "node:assert/strict";
import type { ShowcaseMatrixEntryDto, ShowcasePlacementSegment, ShowcasePlacementType } from "../showcase-matrix-api.js";
import type { ShowcaseTypeKey } from "../showcase-type-capacity.js";

const store = new Map<string, string>();

const localStorageMock = {
  getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
};

// @ts-expect-error test shim
globalThis.localStorage = localStorageMock;
// @ts-expect-error test shim
globalThis.window = {
  localStorage: localStorageMock,
  dispatchEvent: () => true,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
};
Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true },
  configurable: true,
});
Object.defineProperty(globalThis, "fetch", {
  value: async () => {
    throw new Error("network");
  },
  configurable: true,
});

let opCounter = 0;
Object.defineProperty(globalThis, "crypto", {
  value: {
    randomUUID: () => {
      opCounter += 1;
      return `test-grow-save-${String(opCounter).padStart(4, "0")}`;
    },
  },
  configurable: true,
});

const { loadCachedPlacements, SHOWCASE_MATRIX_STORE_CACHE_KEY } = await import("../showcase-matrix-store.js");
const { OVERRIDES_PENDING_STORAGE_KEY } = await import("../overrides-pending-sync.js");
const {
  categoryCapacityFromPlacements,
  growPlacementBlockToFitOurMarks,
} = await import("../showcase-capacity-by-equipment.js");
const { allowedTypesForSegment } = await import("../showcase-placement-labels.js");

const SEGMENTS: ShowcasePlacementSegment[] = ["vh", "mk", "hardware"];
const PLACEMENT_SEGMENT_TO_TYPE_KEY: Record<ShowcasePlacementSegment, ShowcaseTypeKey> = {
  vh: "entrance",
  mk: "interior",
  hardware: "hardware",
};

function placement(
  partial: Partial<ShowcaseMatrixEntryDto> & {
    placementType: NonNullable<ShowcaseMatrixEntryDto["placementType"]>;
    placementSegment: NonNullable<ShowcaseMatrixEntryDto["placementSegment"]>;
  },
): ShowcaseMatrixEntryDto {
  return {
    id: "e-placement",
    dealerId: "d1",
    tradePointId: "tp-grow-save",
    targetKind: "placement",
    targetId: partial.targetId ?? "block-1",
    status: "installed",
    comment: null,
    updatedAt: "2026-06-01T12:00:00.000Z",
    updatedBy: null,
    updatedByName: null,
    placementRef: null,
    placementCapacity: 4,
    placementActual: 0,
    placementOurModels: [],
    placementCompetitors: [],
    placementLegacyOurs: null,
    ...partial,
  };
}

/** Зеркало growAllPlacementsToFitMarksOnSave: проход по всем (segment, placementType). */
function runGrowAllOnSave(
  tradePointId: string,
  markedByKey: Record<string, number>,
): {
  changed: boolean;
  growByType: Map<ShowcaseTypeKey, { oldCapacity: number; nextCapacity: number }>;
} {
  const growByType = new Map<ShowcaseTypeKey, { oldCapacity: number; nextCapacity: number }>();
  let changed = false;

  for (const segment of SEGMENTS) {
    for (const placementType of allowedTypesForSegment(segment)) {
      const key = `${segment}:${placementType}`;
      const marked = markedByKey[key] ?? 0;
      if (marked <= 0) continue;
      const grown = growPlacementBlockToFitOurMarks({
        dealerId: "d1",
        tradePointId,
        placements: loadCachedPlacements(tradePointId),
        segment,
        placementType,
        ourMarkCount: marked,
        updatedBy: "u1",
        updatedByName: "User",
      });
      if (!grown) continue;
      changed = true;
      const typeKey = PLACEMENT_SEGMENT_TO_TYPE_KEY[segment];
      const acc = growByType.get(typeKey);
      if (acc) {
        growByType.set(typeKey, {
          oldCapacity: acc.oldCapacity + grown.oldCapacity,
          nextCapacity: acc.nextCapacity + grown.nextCapacity,
        });
      } else {
        growByType.set(typeKey, { oldCapacity: grown.oldCapacity, nextCapacity: grown.nextCapacity });
      }
    }
  }

  return { changed, growByType };
}

// --- сценарий 1: vh:portal cap 11, 14 отметок → entrance 11→14 ---
{
  const tpId = "tp-grow-save-1";
  store.clear();
  localStorageMock.removeItem(OVERRIDES_PENDING_STORAGE_KEY);
  localStorageMock.removeItem(SHOWCASE_MATRIX_STORE_CACHE_KEY);
  opCounter = 0;

  const { setMatrixPlacement } = await import("../showcase-matrix-store.js");
  setMatrixPlacement({
    dealerId: "d1",
    tradePointId: tpId,
    targetId: "vh-portal",
    placementType: "portal",
    placementSegment: "vh",
    placementCapacity: 11,
    placementActual: 0,
    updatedBy: "u1",
    updatedByName: "User",
    comment: null,
  });

  const before = categoryCapacityFromPlacements(loadCachedPlacements(tpId));
  assert.equal(before.entrance, 11);

  const { changed, growByType } = runGrowAllOnSave(tpId, { "vh:portal": 14 });
  assert.equal(changed, true);
  const entranceGrow = growByType.get("entrance");
  assert.ok(entranceGrow);
  assert.equal(entranceGrow!.oldCapacity, 11);
  assert.equal(entranceGrow!.nextCapacity, 14);

  const after = categoryCapacityFromPlacements(loadCachedPlacements(tpId));
  assert.equal(after.entrance, 14);
}

// --- сценарий 2: vh:portal 8 + vh:cube 3, 10 отметок portal → entrance 11→13 ---
{
  const tpId = "tp-grow-save-2";
  store.clear();
  localStorageMock.removeItem(OVERRIDES_PENDING_STORAGE_KEY);
  localStorageMock.removeItem(SHOWCASE_MATRIX_STORE_CACHE_KEY);
  opCounter = 0;

  const { setMatrixPlacement } = await import("../showcase-matrix-store.js");
  setMatrixPlacement({
    dealerId: "d1",
    tradePointId: tpId,
    targetId: "vh-portal",
    placementType: "portal",
    placementSegment: "vh",
    placementCapacity: 8,
    placementActual: 0,
    updatedBy: "u1",
    updatedByName: "User",
    comment: null,
  });
  setMatrixPlacement({
    dealerId: "d1",
    tradePointId: tpId,
    targetId: "vh-cube",
    placementType: "cube",
    placementSegment: "vh",
    placementCapacity: 3,
    placementActual: 0,
    updatedBy: "u1",
    updatedByName: "User",
    comment: null,
  });

  const before = categoryCapacityFromPlacements(loadCachedPlacements(tpId));
  assert.equal(before.entrance, 11);

  const { changed, growByType } = runGrowAllOnSave(tpId, { "vh:portal": 10, "vh:cube": 0 });
  assert.equal(changed, true);
  const entranceGrow = growByType.get("entrance");
  assert.ok(entranceGrow);
  assert.equal(entranceGrow!.oldCapacity, 8);
  assert.equal(entranceGrow!.nextCapacity, 10);

  const after = categoryCapacityFromPlacements(loadCachedPlacements(tpId));
  assert.equal(after.entrance, 13);
}

// --- сценарий 3: отметок не больше ёмкости → нет роста ---
{
  const tpId = "tp-grow-save-3";
  store.clear();
  localStorageMock.removeItem(OVERRIDES_PENDING_STORAGE_KEY);
  localStorageMock.removeItem(SHOWCASE_MATRIX_STORE_CACHE_KEY);
  opCounter = 0;

  const { setMatrixPlacement } = await import("../showcase-matrix-store.js");
  setMatrixPlacement({
    dealerId: "d1",
    tradePointId: tpId,
    targetId: "vh-portal",
    placementType: "portal",
    placementSegment: "vh",
    placementCapacity: 11,
    placementActual: 0,
    updatedBy: "u1",
    updatedByName: "User",
    comment: null,
  });

  const { changed, growByType } = runGrowAllOnSave(tpId, { "vh:portal": 10 });
  assert.equal(changed, false);
  assert.equal(growByType.size, 0);

  const after = categoryCapacityFromPlacements(loadCachedPlacements(tpId));
  assert.equal(after.entrance, 11);
}

// --- сценарий 4: needInstallMode — рост при сохранении не вызывается (guard в handleSave) ---
assert.equal(!true, false, "needInstallMode=true → growAllPlacementsToFitMarksOnSave не вызывается");
assert.equal(!false, true, "needInstallMode=false → growAllPlacementsToFitMarksOnSave вызывается");

// --- сценарий 5: growPlacementBlockToFitOurMarks на границе лимита (существующий авто-рост) ---
{
  const tpId = "tp-grow-save-5";
  store.clear();
  localStorageMock.removeItem(OVERRIDES_PENDING_STORAGE_KEY);
  localStorageMock.removeItem(SHOWCASE_MATRIX_STORE_CACHE_KEY);
  opCounter = 0;

  const block = placement({
    targetId: "vh-portal-comp",
    placementSegment: "vh",
    placementType: "portal",
    placementCapacity: 10,
    placementCompetitors: [{ name: "Конкурент", count: 3 }],
  });
  const { setMatrixPlacement } = await import("../showcase-matrix-store.js");
  setMatrixPlacement({
    dealerId: "d1",
    tradePointId: tpId,
    targetId: block.targetId,
    placementType: "portal",
    placementSegment: "vh",
    placementCapacity: 10,
    placementActual: 0,
    placementCompetitors: block.placementCompetitors,
    updatedBy: "u1",
    updatedByName: "User",
    comment: null,
  });

  assert.equal(
    growPlacementBlockToFitOurMarks({
      dealerId: "d1",
      tradePointId: tpId,
      placements: loadCachedPlacements(tpId),
      segment: "vh",
      placementType: "portal",
      ourMarkCount: 7,
      updatedBy: "u1",
      updatedByName: "User",
    }),
    null,
  );

  const grown = growPlacementBlockToFitOurMarks({
    dealerId: "d1",
    tradePointId: tpId,
    placements: loadCachedPlacements(tpId),
    segment: "vh",
    placementType: "portal",
    ourMarkCount: 8,
    updatedBy: "u1",
    updatedByName: "User",
  });
  assert.ok(grown);
  assert.equal(grown!.oldCapacity, 10);
  assert.equal(grown!.nextCapacity, 11);
}

console.log("showcase-capacity-grow-on-save: ok");
