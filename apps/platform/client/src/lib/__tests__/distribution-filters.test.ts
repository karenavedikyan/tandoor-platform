/**
 * Запуск: npm run test:distribution-filters
 */
import assert from "node:assert/strict";
import type { DealerRow } from "../dealer-base-mock-data.js";
import type { ShowcaseMatrixEntryDto } from "../showcase-matrix-api.js";
import {
  defaultDistributionFilterState,
  extractCityOptions,
  extractRegionOptions,
  filterMatrixEntries,
  filterScopeDealers,
  modelMatchesSegment,
  periodWindowIso,
  buildAnalyticsFilterContext,
} from "../distribution-filters";
import type { ShowcaseMatrixModelDefinition } from "../trade-point-showcase-matrix-models";

const NOW = Date.parse("2026-06-01T12:00:00.000Z");

const dealerMsk: DealerRow = {
  id: "d-msk",
  name: "Клиент Москва",
  city: "Москва",
  region: "Центр",
  status: "активный",
  clientCategory: "top350",
  tradePoints: [
    { id: "tp1", name: "ТТ 1", city: "Москва", address: "", status: "активный" },
  ],
} as DealerRow;

const dealerKzn: DealerRow = {
  id: "d-kzn",
  name: "Клиент Казань",
  city: "Казань",
  region: "Поволжье",
  status: "активный",
  clientCategory: "top150",
  tradePoints: [
    { id: "tp2", name: "ТТ 2", city: "Казань", address: "", status: "активный" },
  ],
} as DealerRow;

const defaults = defaultDistributionFilterState();
assert.equal(defaults.period.kind, "all");
assert.equal(defaults.segment, "all");
assert.equal(defaults.clientCategory, "all");
assert.equal(defaults.region, "all");
assert.equal(defaults.city, "all");

const filteredCat = filterScopeDealers([dealerMsk, dealerKzn], {
  ...defaults,
  clientCategory: "top150",
});
assert.equal(filteredCat.length, 1);
assert.equal(filteredCat[0]?.id, "d-kzn");

const filteredCity = filterScopeDealers([dealerMsk, dealerKzn], {
  ...defaults,
  city: "Москва",
});
assert.equal(filteredCity.length, 1);
assert.equal(filteredCity[0]?.id, "d-msk");

const filteredCombo = filterScopeDealers([dealerMsk, dealerKzn], {
  ...defaults,
  region: "Центр",
  clientCategory: "top350",
});
assert.equal(filteredCombo.length, 1);

const allDealers = filterScopeDealers([dealerMsk, dealerKzn], defaults);
assert.equal(allDealers.length, 2);

const winAll = periodWindowIso({ kind: "all" }, NOW);
assert.equal(winAll.fromIso, null);
assert.equal(winAll.toIso, null);

const win7 = periodWindowIso({ kind: "last7" }, NOW);
assert.ok(win7.fromIso);
assert.ok(win7.toIso);
const fromMs = Date.parse(win7.fromIso!);
assert.equal(fromMs, NOW - 7 * 86_400_000);

const winCustom = periodWindowIso(
  { kind: "custom", fromIso: "2026-01-01T00:00:00.000Z", toIso: "2026-02-01T00:00:00.000Z" },
  NOW,
);
assert.equal(winCustom.fromIso, "2026-01-01T00:00:00.000Z");
assert.equal(winCustom.toIso, "2026-02-01T00:00:00.000Z");

const entranceModel = {
  id: "m-vh",
  type: "entrance",
} as ShowcaseMatrixModelDefinition;
const interiorModel = {
  id: "m-mk",
  type: "interior",
} as ShowcaseMatrixModelDefinition;

assert.equal(modelMatchesSegment(entranceModel, "vh"), true);
assert.equal(modelMatchesSegment(entranceModel, "mk"), false);
assert.equal(modelMatchesSegment(interiorModel, "mk"), true);
assert.equal(modelMatchesSegment(interiorModel, "furniture"), false);

const entry: ShowcaseMatrixEntryDto = {
  id: "e1",
  dealerId: "d1",
  tradePointId: "tp1",
  targetKind: "model",
  targetId: "m-vh",
  status: "installed",
  comment: null,
  updatedAt: "2026-05-15T10:00:00.000Z",
  updatedBy: null,
  updatedByName: null,
  placementType: null,
  placementSegment: null,
  placementCapacity: null,
  placementActual: null,
  placementRef: null,
};

const ctx = buildAnalyticsFilterContext({ ...defaults, period: { kind: "last30" } }, NOW);
const filteredEntries = filterMatrixEntries([entry], ctx, new Set(["m-vh"]));
assert.equal(filteredEntries.length, 1);

const ctxOld = buildAnalyticsFilterContext({ ...defaults, period: { kind: "last7" } }, NOW);
const filteredOld = filterMatrixEntries([entry], ctxOld, new Set(["m-vh"]));
assert.equal(filteredOld.length, 0);

assert.deepEqual(extractRegionOptions([dealerMsk, dealerKzn]), ["Поволжье", "Центр"]);
assert.ok(extractCityOptions([dealerMsk, dealerKzn]).includes("Казань"));
assert.ok(extractCityOptions([dealerMsk, dealerKzn]).includes("Москва"));

console.log("✓ distribution-filters tests passed");
