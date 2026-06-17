/**
 * Запуск: npm run test:distribution-matrix-catalog-view-model (из apps/platform).
 */
import assert from "node:assert/strict";
import type { ShowcaseMatrixDefDto } from "../showcase-matrix-catalog-api.js";
import {
  filterMatrixDefs,
  formatMatrixDefPeriodLabel,
  formatMatrixDefScopeLabel,
  groupMatrixDefsByClientCategory,
  isMatrixPeriodRangeValid,
} from "../distribution-matrix-catalog-view-model";

function def(partial: Partial<ShowcaseMatrixDefDto> & Pick<ShowcaseMatrixDefDto, "id" | "clientCategory">): ShowcaseMatrixDefDto {
  return {
    scopeKind: "global",
    scopeRegion: null,
    scopeCity: null,
    effectiveFrom: null,
    effectiveTo: null,
    seasonLabel: null,
    status: "draft",
    title: null,
    comment: null,
    clientOpId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    updatedBy: null,
    updatedByName: null,
    ...partial,
  };
}

assert.equal(formatMatrixDefScopeLabel({ scopeKind: "global", scopeRegion: null, scopeCity: null }), "Глобально");
assert.equal(
  formatMatrixDefScopeLabel({ scopeKind: "region", scopeRegion: "Краснодарский край", scopeCity: null }),
  "Регион «Краснодарский край»",
);
assert.equal(
  formatMatrixDefScopeLabel({ scopeKind: "city", scopeRegion: "Краснодарский край", scopeCity: "Краснодар" }),
  "Город «Краснодар, Краснодарский край»",
);

assert.equal(formatMatrixDefPeriodLabel(null, null), "бессрочно");
assert.equal(formatMatrixDefPeriodLabel("2026-01-15", null), "15.01.2026 – бессрочно");
assert.equal(formatMatrixDefPeriodLabel(null, "2026-12-31"), "с любой даты – 31.12.2026");
assert.ok(isMatrixPeriodRangeValid("2026-01-01", "2026-06-01"));
assert.equal(isMatrixPeriodRangeValid("2026-06-01", "2026-01-01"), false);

const rows = [
  def({ id: "1", clientCategory: "top350", scopeKind: "global", title: "Зима" }),
  def({ id: "2", clientCategory: "top150", scopeKind: "region", scopeRegion: "москва" }),
  def({ id: "3", clientCategory: "top150", scopeKind: "city", scopeRegion: "московская", scopeCity: "химки" }),
  def({ id: "4", clientCategory: "top350", status: "published" }),
];

const filtered = filterMatrixDefs(rows, { clientCategory: "top150", status: "all", search: "моск" });
assert.equal(filtered.length, 2);

const groups = groupMatrixDefsByClientCategory(rows);
assert.equal(groups.length, 2);
assert.equal(groups[0]!.clientCategory, "top150");
assert.equal(groups[0]!.defs.length, 2);
assert.equal(groups[0]!.defs[0]!.scopeKind, "region");
assert.equal(groups[1]!.clientCategory, "top350");

console.log("distribution-matrix-catalog-view-model.test.ts: ok");
