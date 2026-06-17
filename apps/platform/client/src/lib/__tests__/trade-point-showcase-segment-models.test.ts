/**
 * Запуск: `npm run test:trade-point-showcase-segment-models` из каталога apps/platform.
 */
import { strict as assert } from "node:assert";
import test from "node:test";

import { buildSegmentDetail } from "../trade-point-showcase-segment-models.js";
import type { ShowcaseMatrixEntryDto } from "../showcase-matrix-api.js";

function makeBlock(opts: {
  segment: "vh" | "mk" | "hardware";
  placementType?: "portal" | "cube" | "book" | "hoof" | "unmounted" | "branded_stand" | "stream_sku";
  capacity?: number;
  actual?: number | null;
  models?: Array<{ modelId: string; count: number }>;
  competitors?: Array<{ brand: string; count: number }>;
}): ShowcaseMatrixEntryDto {
  return {
    id: `b-${Math.random()}`,
    dealerId: "d",
    tradePointId: "tp",
    targetKind: "placement",
    targetId: "t",
    status: "installed",
    comment: null,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    updatedByName: null,
    placementType: opts.placementType ?? "portal",
    placementSegment: opts.segment,
    placementCapacity: opts.capacity ?? 4,
    placementActual: opts.actual === undefined ? 0 : opts.actual,
    placementRef: null,
    placementOurModels: opts.models ?? [],
    placementCompetitors: opts.competitors ?? [],
  };
}

const VH_MODEL = "tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya";
const MK_MODEL = "tc-mk-baget-12-mokko-pet-dg-2000-800-94";

function makeModelEntry(targetId: string, status: ShowcaseMatrixEntryDto["status"] = "installed"): ShowcaseMatrixEntryDto {
  return {
    id: `m-${Math.random()}`,
    dealerId: "d",
    tradePointId: "tp",
    targetKind: "model",
    targetId,
    status,
    comment: null,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    updatedByName: null,
    placementType: null,
    placementSegment: null,
    placementCapacity: null,
    placementActual: null,
    placementRef: null,
    placementOurModels: [],
    placementCompetitors: [],
  };
}

test("buildSegmentDetail: считает totalCapacity/totalOurs/percent", () => {
  const entries = [
    makeBlock({ segment: "vh", capacity: 4, actual: 3 }),
    makeBlock({ segment: "vh", capacity: 4, actual: 2 }),
    makeBlock({ segment: "mk", capacity: 10, actual: 1 }),
  ];
  const vh = buildSegmentDetail(entries, "vh");
  assert.equal(vh.source, "blocks");
  assert.equal(vh.blockCount, 2);
  assert.equal(vh.totalCapacity, 8);
  assert.equal(vh.totalOurs, 5);
  assert.equal(vh.distributionPercent, 62);
});

test("buildSegmentDetail: разбивка по placementType", () => {
  const entries = [
    makeBlock({ segment: "vh", placementType: "portal", capacity: 4, actual: 4 }),
    makeBlock({ segment: "vh", placementType: "portal", capacity: 4, actual: 4 }),
    makeBlock({
      segment: "vh",
      placementType: "cube",
      capacity: 4,
      actual: 3,
      competitors: [{ brand: "X", count: 1 }],
    }),
  ];
  const vh = buildSegmentDetail(entries, "vh");
  const portal = vh.byPlacementType.find((r) => r.placementType === "portal");
  const cube = vh.byPlacementType.find((r) => r.placementType === "cube");
  assert.equal(portal?.blockCount, 2);
  assert.equal(portal?.capacity, 8);
  assert.equal(portal?.ours, 8);
  assert.equal(cube?.competitors, 1);
  assert.equal(cube?.free, 0);
});

test("buildSegmentDetail: actual=null использует сумму ourModels", () => {
  const entries = [
    makeBlock({
      segment: "vh",
      actual: null,
      models: [
        { modelId: "a", count: 2 },
        { modelId: "b", count: 3 },
      ],
    }),
  ];
  const vh = buildSegmentDetail(entries, "vh");
  assert.equal(vh.totalOurs, 5);
});

test("buildSegmentDetail: уникальные модели суммируются", () => {
  const entries = [
    makeBlock({ segment: "vh", models: [{ modelId: "a", count: 1 }] }),
    makeBlock({
      segment: "vh",
      models: [
        { modelId: "a", count: 2 },
        { modelId: "b", count: 1 },
      ],
    }),
  ];
  const vh = buildSegmentDetail(entries, "vh");
  assert.equal(vh.ourModels.find((m) => m.modelId === "a")?.count, 3);
  assert.equal(vh.ourModels.length, 2);
});

test("buildSegmentDetail: конкуренты агрегируются и сортируются по count desc", () => {
  const entries = [
    makeBlock({ segment: "vh", competitors: [{ brand: "Браво", count: 2 }] }),
    makeBlock({
      segment: "vh",
      competitors: [
        { brand: "Браво", count: 1 },
        { brand: "Феррони", count: 3 },
      ],
    }),
  ];
  const vh = buildSegmentDetail(entries, "vh");
  const byBrand = Object.fromEntries(vh.competitorRows.map((r) => [r.brand, r.count]));
  assert.equal(byBrand["Феррони"], 3);
  assert.equal(byBrand["Браво"], 3);
  assert.equal(vh.competitorRows[0]?.count, 3);
});

test("buildSegmentDetail: пустой сегмент → нули", () => {
  const detail = buildSegmentDetail([], "hardware");
  assert.equal(detail.source, "empty");
  assert.equal(detail.blockCount, 0);
  assert.equal(detail.totalCapacity, 0);
  assert.equal(detail.distributionPercent, 0);
  assert.equal(detail.byPlacementType.length, 0);
});

test("fallback по моделям ВХ: installed entrance без placement-блоков", () => {
  const entries = [
    makeModelEntry(VH_MODEL),
    makeModelEntry("tc-vh-panteon-bukle-temno-seryy-chernyy-kvarts-860kh2050-levaya"),
  ];
  const vh = buildSegmentDetail(entries, "vh");
  assert.equal(vh.source, "models");
  assert.equal(vh.totalOurs, 2);
  assert.equal(vh.ourModels.length, 2);
  assert.equal(vh.blockCount, 0);
  assert.equal(vh.totalCapacity, 0);
  assert.equal(vh.distributionPercent, 0);
});

test("fallback по моделям МК: installed interior без placement-блоков", () => {
  const entries = [
    makeModelEntry(MK_MODEL),
    makeModelEntry("tc-mk-grand-13-medzhik-pet-dg-2000-800"),
  ];
  const mk = buildSegmentDetail(entries, "mk");
  assert.equal(mk.source, "models");
  assert.equal(mk.totalOurs, 2);
  assert.equal(mk.ourModels.length, 2);
  assert.equal(mk.blockCount, 0);
  assert.equal(mk.totalCapacity, 0);
});

test("placement + installed: totalOurs учитывает max(блоки, installed модели)", () => {
  const entries = [
    makeBlock({ segment: "vh", capacity: 4, actual: 0 }),
    makeModelEntry(VH_MODEL),
    makeModelEntry("tc-vh-midas-orekh-pekan-shokolad-emalit-belyy-860kh2050-levaya"),
  ];
  const vh = buildSegmentDetail(entries, "vh");
  assert.equal(vh.source, "blocks");
  assert.equal(vh.blockCount, 1);
  assert.equal(vh.totalCapacity, 4);
  assert.equal(vh.totalOurs, 2);
  assert.equal(vh.ourModels.length, 2);
});

test("hardware без fallback: model-entries не попадают в сегмент", () => {
  const entries = [makeModelEntry(VH_MODEL), makeModelEntry(MK_MODEL)];
  const hw = buildSegmentDetail(entries, "hardware");
  assert.equal(hw.source, "empty");
  assert.equal(hw.totalOurs, 0);
});

test("buildSegmentDetail: разные сегменты изолированы", () => {
  const entries = [
    makeBlock({ segment: "vh", models: [{ modelId: "a", count: 1 }] }),
    makeBlock({ segment: "mk", models: [{ modelId: "b", count: 1 }] }),
  ];
  assert.equal(buildSegmentDetail(entries, "vh").ourModels.length, 1);
  assert.equal(buildSegmentDetail(entries, "mk").ourModels.length, 1);
  assert.equal(buildSegmentDetail(entries, "hardware").ourModels.length, 0);
});

console.log("trade-point-showcase-segment-models: ok");
