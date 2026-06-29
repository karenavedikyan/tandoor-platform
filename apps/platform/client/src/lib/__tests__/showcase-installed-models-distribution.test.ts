/**
 * Запуск: npm run test:showcase-installed-models-distribution
 */
import assert from "node:assert/strict";
import type { ShowcaseMatrixEntryDto } from "../showcase-matrix-api.js";
import { computeDistributionOnPoint } from "../showcase-distribution-on-point.js";
import { segmentForModelTargetId } from "../showcase-model-segment.js";
import { buildSegmentDetail } from "../trade-point-showcase-segment-models.js";

const VH_CATALOG = "tc-vh-astra-bukle-opal-belyy-matovyy-960kh2200-levaya";
const MK_CATALOG = "tc-mk-dekanto-belyy-evo-pet-dg-2000-800";
const HW_CATALOG = "tc-hw-ruchka-dvernaya-tandoor-tdal-701-02-black-chernyy-td185225";
const VH_SEED = "tc-vh-era-grafit-belyy-matovyy-860kh2050-levaya";

assert.equal(segmentForModelTargetId("tc-vh-custom-model"), "vh");
assert.equal(segmentForModelTargetId("tc-mk-custom-model"), "mk");
assert.equal(segmentForModelTargetId("tc-hw-custom-model"), "hardware");
assert.equal(segmentForModelTargetId(VH_CATALOG), "vh");
assert.equal(segmentForModelTargetId(MK_CATALOG), "mk");
assert.equal(segmentForModelTargetId(HW_CATALOG), "hardware");
assert.equal(segmentForModelTargetId(VH_SEED), "vh");
assert.equal(segmentForModelTargetId("unknown-model-id"), null);

function makeBlock(segment: "vh" | "mk" | "hardware", capacity: number): ShowcaseMatrixEntryDto {
  return {
    id: `b-${segment}-${capacity}`,
    dealerId: "d",
    tradePointId: "tp",
    targetKind: "placement",
    targetId: "t",
    status: "installed",
    comment: null,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    updatedByName: null,
    placementType: "portal",
    placementSegment: segment,
    placementCapacity: capacity,
    placementActual: 0,
    placementRef: null,
    placementOurModels: [],
    placementCompetitors: [],
    placementLegacyOurs: null,
  };
}

function makeInstalledModel(targetId: string): ShowcaseMatrixEntryDto {
  return {
    id: `m-${targetId}`,
    dealerId: "d",
    tradePointId: "tp",
    targetKind: "model",
    targetId,
    status: "installed",
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
    placementLegacyOurs: null,
  };
}

const scenarioEntries: ShowcaseMatrixEntryDto[] = [
  makeBlock("vh", 83),
  makeBlock("mk", 197),
  makeBlock("hardware", 105),
  ...Array.from({ length: 9 }, (_, i) => makeInstalledModel(`tc-vh-installed-${i}`)),
  ...Array.from({ length: 11 }, (_, i) => makeInstalledModel(`tc-mk-installed-${i}`)),
  ...Array.from({ length: 10 }, (_, i) => makeInstalledModel(`tc-hw-installed-${i}`)),
];

const distribution = computeDistributionOnPoint({
  entries: scenarioEntries,
  installedOursBySegment: { vh: 9, mk: 11, hardware: 10 },
  portalCapacity: { entrance: 0, interior: 0, hardware: 0 },
});

assert.equal(distribution.vh.ours, 9);
assert.equal(distribution.mk.ours, 11);
assert.equal(distribution.hardware.ours, 10);
assert.equal(distribution.total.ours, 30);
assert.ok(distribution.vh.pct > 0);
assert.ok(distribution.mk.pct > 0);
assert.ok(distribution.hardware.pct > 0);
assert.ok(distribution.total.pct > 0);

const vhDetail = buildSegmentDetail(scenarioEntries, "vh");
const mkDetail = buildSegmentDetail(scenarioEntries, "mk");
const hwDetail = buildSegmentDetail(scenarioEntries, "hardware");
assert.equal(vhDetail.totalOurs, 9);
assert.equal(mkDetail.totalOurs, 11);
assert.equal(hwDetail.totalOurs, 10);
assert.ok(vhDetail.distributionPercent > 0);
assert.ok(mkDetail.distributionPercent > 0);
assert.ok(hwDetail.distributionPercent > 0);

const manualHigherEntries: ShowcaseMatrixEntryDto[] = [
  {
    ...makeBlock("vh", 10),
    placementActual: 7,
  },
  makeInstalledModel("tc-vh-installed-0"),
  makeInstalledModel("tc-vh-installed-1"),
];
const manualHigher = computeDistributionOnPoint({
  entries: manualHigherEntries,
  installedOursBySegment: { vh: 2, mk: 0, hardware: 0 },
  portalCapacity: { entrance: 0, interior: 0, hardware: 0 },
});
assert.equal(manualHigher.vh.ours, 7, "ручной ввод в блоке не уменьшается");

const catalogOnlyEntries = [makeInstalledModel(MK_CATALOG)];
const mkCatalog = buildSegmentDetail(catalogOnlyEntries, "mk");
assert.equal(mkCatalog.totalOurs, 1);
assert.equal(mkCatalog.source, "models");

{
  const mkLegacyBlock: ShowcaseMatrixEntryDto = {
    ...makeBlock("mk", 10),
    placementLegacyOurs: 3,
  };
  const legacyDistribution = computeDistributionOnPoint({
    entries: [mkLegacyBlock],
    installedOursBySegment: { vh: 0, mk: 0, hardware: 0 },
    portalCapacity: { entrance: 0, interior: 0, hardware: 0 },
  });
  assert.equal(legacyDistribution.mk.legacyOurs, 3);
  assert.equal(legacyDistribution.mk.rotationPct, 30);
  assert.equal(legacyDistribution.total.legacyOurs, 3);
  assert.equal(legacyDistribution.total.rotationPct, 30);
}

console.log("✓ showcase-installed-models-distribution tests passed");
