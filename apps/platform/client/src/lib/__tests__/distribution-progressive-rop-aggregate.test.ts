/**
 * Запуск: `npm run test:distribution-progressive-rop-aggregate` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import {
  aggregateDistribution,
  computeDistributionForTradePoint,
} from "../distribution-analytics/distribution-analytics-math.js";
import type { ShowcaseMatrixEntryDto } from "../showcase-matrix-api.js";
import {
  buildTradePointExternalKeysByRopFromScopedDb,
  activeTradePointExternalKeysFromScopedTradePoints,
} from "../trade-points-scoped-ids.js";
import type { ScopedTradePointDto } from "../trade-points-scoped-api.js";
import {
  resetDistributionDbPrimaryFlagCache,
  seedDistributionDbPrimaryFromBootstrap,
} from "../distribution-db-primary-flag.js";

function tp(
  partial: Partial<ScopedTradePointDto> & Pick<ScopedTradePointDto, "id" | "externalKey">,
): ScopedTradePointDto {
  return {
    name: "TP",
    city: "Москва",
    address: null,
    format: null,
    isActive: true,
    isPrimary: false,
    importanceTier: null,
    dealerId: "d1",
    dealerExternalKey: "d1",
    dealerName: "Dealer",
    dealerReleaseCode: null,
    dealerCity: null,
    dealerClientCategory: null,
    managerUserId: "m1",
    managerFullName: "Иванов",
    regionalManagerUserId: null,
    regionalManagerFullName: null,
    teamId: "team-a",
    teamName: "Team A",
    ropUserId: "rop-a",
    ropFullName: "РОП A",
    ...partial,
  };
}

function placement(tradePointId: string, capacity: number, segment: "vh" | "mk" = "vh"): ShowcaseMatrixEntryDto {
  return {
    id: `p-${segment}-${tradePointId}`,
    dealerId: "d1",
    tradePointId,
    targetKind: "placement",
    targetId: `placement-${segment}`,
    status: "installed",
    comment: null,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    updatedByName: null,
    placementType: "book",
    placementSegment: segment,
    placementCapacity: capacity,
    placementActual: null,
    placementRef: null,
    placementOurModels: [],
    placementCompetitors: [],
    placementLegacyOurs: null,
  };
}

function installedModel(tradePointId: string, targetId: string): ShowcaseMatrixEntryDto {
  return {
    id: `m-${targetId}`,
    dealerId: "d1",
    tradePointId,
    targetKind: "model",
    targetId,
    status: "installed",
    comment: null,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    updatedByName: null,
    placementType: null,
    placementSegment: "vh",
    placementCapacity: null,
    placementActual: null,
    placementRef: null,
    placementOurModels: [],
    placementCompetitors: [],
    placementLegacyOurs: null,
  };
}

function aggregateForKeys(
  keys: string[],
  matrixByKey: Record<string, ShowcaseMatrixEntryDto[]>,
) {
  const metrics = keys.map((key) =>
    computeDistributionForTradePoint(undefined, matrixByKey[key] ?? []),
  );
  return aggregateDistribution(metrics);
}

resetDistributionDbPrimaryFlagCache();
seedDistributionDbPrimaryFromBootstrap({ flags: { DISTRIBUTION_DB_PRIMARY_CAPACITY: true } });
try {
  const tradePoints = [
    tp({ id: "u1", externalKey: "ek-1", teamId: "team-a", ropFullName: "РОП A" }),
    tp({ id: "u2", externalKey: "ek-2", teamId: "team-a", ropFullName: "РОП A" }),
    tp({ id: "u3", externalKey: "ek-3", teamId: "team-b", ropFullName: "РОП B" }),
    tp({ id: "u4", externalKey: "ek-4", teamId: null, ropUserId: null }),
  ];

  const matrixByKey: Record<string, ShowcaseMatrixEntryDto[]> = {
    "ek-1": [placement("ek-1", 10), installedModel("ek-1", "tc-vh-1"), installedModel("ek-1", "tc-vh-2")],
    "ek-2": [placement("ek-2", 20, "mk"), installedModel("ek-2", "tc-mk-1")],
    "ek-3": [placement("ek-3", 5), installedModel("ek-3", "tc-vh-3")],
    "ek-4": [placement("ek-4", 8, "hardware")],
  };

  const allKeys = activeTradePointExternalKeysFromScopedTradePoints(tradePoints);
  const monolith = aggregateForKeys(allKeys, matrixByKey);

  const buckets = buildTradePointExternalKeysByRopFromScopedDb(tradePoints);
  const bucketMetrics = buckets.flatMap((bucket) =>
    bucket.externalKeys.map((key) =>
      computeDistributionForTradePoint(undefined, matrixByKey[key] ?? []),
    ),
  );
  const fromBuckets = aggregateDistribution(bucketMetrics);

  assert.equal(monolith.tradePointsCount, fromBuckets.tradePointsCount);
  assert.equal(monolith.byType.entrance.capacity, fromBuckets.byType.entrance.capacity);
  assert.equal(monolith.byType.entrance.tandoorOnShelf, fromBuckets.byType.entrance.tandoorOnShelf);
  assert.equal(monolith.byType.interior.capacity, fromBuckets.byType.interior.capacity);
  assert.equal(monolith.byType.hardware.capacity, fromBuckets.byType.hardware.capacity);
  assert.equal(monolith.totalLegacyOurs, fromBuckets.totalLegacyOurs);
  assert.ok(
    Math.abs((monolith.byType.entrance.percent ?? 0) - (fromBuckets.byType.entrance.percent ?? 0)) < 1e-9,
  );
  assert.ok(
    Math.abs((monolith.averagePercent ?? 0) - (fromBuckets.averagePercent ?? 0)) < 1e-9,
  );
} finally {
  resetDistributionDbPrimaryFlagCache();
}

console.log("distribution-progressive-rop-aggregate: ok");
