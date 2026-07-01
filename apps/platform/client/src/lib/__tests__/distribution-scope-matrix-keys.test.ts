/**
 * Запуск: `npm run test:distribution-scope-matrix-keys` из каталога apps/platform.
 *
 * Регрессия: showcase_matrix_entries.trade_point_id = external_key, не UUID trade_points.id.
 */
import assert from "node:assert/strict";
import {
  aggregateDistribution,
  capacityFromMatrixEntries,
  computeDistributionForTradePoint,
} from "../distribution-analytics/distribution-analytics-math.js";
import type { ShowcaseMatrixEntryDto } from "../showcase-matrix-api.js";
import {
  activeTradePointExternalKeysFromScopedTradePoints,
  activeTradePointIdsFromScopedTradePoints,
} from "../trade-points-scoped-ids.js";
import type { ScopedTradePointDto } from "../trade-points-scoped-api.js";
import {
  resetDistributionDbPrimaryFlagCache,
  seedDistributionDbPrimaryFromBootstrap,
} from "../distribution-db-primary-flag.js";

const UUID = "d162e083-8aa2-45a8-9500-8080eca725e6";
const EXTERNAL_KEY = "client-ma-ma132519-01";

function scopedTp(): ScopedTradePointDto {
  return {
    id: UUID,
    externalKey: EXTERNAL_KEY,
    name: "TP",
    city: "Ростов-на-Дону",
    address: null,
    format: null,
    isActive: true,
    isPrimary: false,
    importanceTier: null,
    dealerId: "dealer-uuid",
    dealerExternalKey: "client-ma-ma132519",
    dealerName: "Dealer",
    dealerReleaseCode: null,
    dealerCity: null,
    dealerClientCategory: null,
    managerUserId: null,
    managerFullName: null,
    regionalManagerUserId: null,
    regionalManagerFullName: null,
    teamId: null,
    teamName: null,
    ropUserId: null,
    ropFullName: null,
  };
}

function placement(tradePointId: string, capacity = 12): ShowcaseMatrixEntryDto {
  return {
    id: `p-vh-${tradePointId}`,
    dealerId: "dealer-uuid",
    tradePointId,
    targetKind: "placement",
    targetId: "placement-vh",
    status: "installed",
    comment: null,
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    updatedByName: null,
    placementType: "book",
    placementSegment: "vh",
    placementCapacity: capacity,
    placementActual: null,
    placementRef: null,
    placementOurModels: [],
    placementCompetitors: [],
    placementLegacyOurs: null,
  };
}

function aggregateForScopeIds(
  scopeIds: string[],
  matrixByTradePointId: Record<string, ShowcaseMatrixEntryDto[]>,
) {
  const metrics = scopeIds.map((id) =>
    computeDistributionForTradePoint(undefined, matrixByTradePointId[id] ?? []),
  );
  return aggregateDistribution(metrics);
}

resetDistributionDbPrimaryFlagCache();
seedDistributionDbPrimaryFromBootstrap({ flags: { DISTRIBUTION_DB_PRIMARY_CAPACITY: true } });
try {
  const matrix = { [EXTERNAL_KEY]: [placement(EXTERNAL_KEY, 12)] };
  const externalKeys = activeTradePointExternalKeysFromScopedTradePoints([scopedTp()]);
  const uuidIds = activeTradePointIdsFromScopedTradePoints([scopedTp()]);

  assert.deepEqual(externalKeys, [EXTERNAL_KEY]);
  assert.deepEqual(uuidIds, [UUID]);

  const aggExternal = aggregateForScopeIds(externalKeys, matrix);
  const aggUuid = aggregateForScopeIds(uuidIds, matrix);

  assert.equal(capacityFromMatrixEntries(matrix[EXTERNAL_KEY]!, "entrance"), 12);
  assert.equal(aggExternal.byType.entrance.capacity, 12);
  assert.equal(aggExternal.tradePointsCount, 1);
  assert.equal(aggUuid.byType.entrance.capacity, 0);
  assert.equal(aggUuid.tradePointsCount, 0);
} finally {
  resetDistributionDbPrimaryFlagCache();
}

console.log("distribution-scope-matrix-keys: ok");
