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

function makeModelEntry(
  targetId: string,
  status: ShowcaseMatrixEntryDto["status"] = "installed",
  placementType: ShowcaseMatrixEntryDto["placementType"] = null,
): ShowcaseMatrixEntryDto {
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
    placementType,
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

test("разбивка по типу: «Наши» из installed моделей, если placementActual пустой", () => {
  const entries = [
    makeBlock({ segment: "vh", placementType: "portal", capacity: 10, actual: 0 }),
    makeBlock({ segment: "vh", placementType: "cube", capacity: 5, actual: 0 }),
    makeBlock({ segment: "vh", placementType: "unmounted", capacity: 3, actual: 0 }),
    makeModelEntry(VH_MODEL, "installed", "portal"),
    makeModelEntry("tc-vh-panteon-bukle-temno-seryy-chernyy-kvarts-860kh2050-levaya", "installed", "portal"),
    makeModelEntry("tc-vh-midas-orekh-pekan-shokolad-emalit-belyy-860kh2050-levaya", "installed", "cube"),
    makeModelEntry("tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya", "installed", "unmounted"),
    makeModelEntry("tc-vh-grand-13-medzhik-pet-dg-2000-800", "installed", "unmounted"),
    makeModelEntry("tc-vh-baget-12-mokko-pet-dg-2000-800-94", "installed", "unmounted"),
  ];
  const vh = buildSegmentDetail(entries, "vh");
  const portal = vh.byPlacementType.find((r) => r.placementType === "portal");
  const cube = vh.byPlacementType.find((r) => r.placementType === "cube");
  const unmounted = vh.byPlacementType.find((r) => r.placementType === "unmounted");

  assert.equal(portal?.ours, 2);
  assert.equal(cube?.ours, 1);
  assert.equal(unmounted?.ours, 3);
  assert.equal(portal?.free, 8);
  assert.equal(cube?.free, 4);
  assert.equal(unmounted?.free, 0);

  const sumOurs = vh.byPlacementType.reduce((sum, row) => sum + row.ours, 0);
  assert.equal(sumOurs, vh.totalOurs);
  assert.equal(vh.totalOurs, 6);
});

test("разбивка по типу: модели без placementType попадают в фоллбэк сегмента", () => {
  const entries = [
    makeBlock({ segment: "vh", placementType: "portal", capacity: 4, actual: 0 }),
    makeModelEntry(VH_MODEL),
    makeModelEntry("tc-vh-panteon-bukle-temno-seryy-chernyy-kvarts-860kh2050-levaya"),
  ];
  const vh = buildSegmentDetail(entries, "vh");
  const unmounted = vh.byPlacementType.find((r) => r.placementType === "unmounted");
  assert.equal(unmounted?.ours, 2);
  assert.equal(unmounted?.blockCount, 0);
  assert.equal(unmounted?.capacity, 0);
  assert.equal(unmounted?.free, 0);
});

test("разбивка по типу: blockOurs сохраняется, если он больше числа installed моделей", () => {
  const entries = [
    makeBlock({ segment: "vh", placementType: "portal", capacity: 10, actual: 5 }),
    makeModelEntry(VH_MODEL, "installed", "portal"),
  ];
  const vh = buildSegmentDetail(entries, "vh");
  const portal = vh.byPlacementType.find((r) => r.placementType === "portal");
  assert.equal(portal?.ours, 5);
  assert.equal(portal?.free, 5);
});

test("hardware: installed catalog-модели учитываются", () => {
  const entries = [makeModelEntry("tc-hw-ruchka-dvernaya-tandoor-tdal-701-02-black-chernyy-td185225")];
  const hw = buildSegmentDetail(entries, "hardware");
  assert.equal(hw.source, "models");
  assert.equal(hw.totalOurs, 1);
});

test("hardware без fallback: model-entries других сегментов не попадают", () => {
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
