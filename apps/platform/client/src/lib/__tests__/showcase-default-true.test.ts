/**
 * Запуск: `npm run test:showcase-default-true` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import {
  normalizeHasShowcase,
  type TradePointShowcaseActualization,
} from "../client-base-actualization-state";
import { deriveShowcaseBucket } from "../trade-point-list-for-actualization";
assert.equal(normalizeHasShowcase(undefined), true);
assert.equal(normalizeHasShowcase(true), true);
assert.equal(normalizeHasShowcase(false), false);

const emptyLegacy: TradePointShowcaseActualization = {
  tradePointId: "tp-1",
  dealerId: "d-1",
  hasShowcase: null,
  totalPortals: null,
  entrancePortals: null,
  interiorPortals: null,
  hardwareSections: null,
  showcaseAreaSqm: null,
  showcaseComment: "",
  tandoorTotalPortals: null,
  tandoorEntrancePortals: null,
  tandoorInteriorPortals: null,
  competitorPortals: null,
  competitorsListed: "",
  fillingComment: "",
  hasExpansionPotential: null,
  additionalPortalsPotential: null,
  showcasePriority: "",
  firstPriorityNeed: "",
  rmRopComment: "",
  updatedAt: new Date().toISOString(),
  updatedBy: "",
  updatedByName: "",
};

{
  const bucket = deriveShowcaseBucket(undefined);
  assert.notEqual(bucket.bucket, "not_filled");
  assert.equal(bucket.bucket, "partial");
}

{
  const bucket = deriveShowcaseBucket(emptyLegacy);
  assert.notEqual(bucket.bucket, "not_filled");
  assert.equal(bucket.bucket, "partial");
}

{
  const bucket = deriveShowcaseBucket({ ...emptyLegacy, hasShowcase: false });
  assert.equal(bucket.bucket, "no_showcase");
}

{
  const bucket = deriveShowcaseBucket({ ...emptyLegacy, hardwareSections: 2 });
  assert.equal(bucket.bucket, "partial");
}

console.log("showcase-default-true: ok");
