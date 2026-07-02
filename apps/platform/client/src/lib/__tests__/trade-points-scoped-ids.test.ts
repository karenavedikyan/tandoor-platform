/**
 * Запуск: `npm run test:trade-points-scoped-ids` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { ScopedTradePointDto } from "../trade-points-scoped-api.js";
import {
  activeTradePointExternalKeysFromScopedResponse,
  activeTradePointExternalKeysFromScopedTradePoints,
  activeTradePointIdsFromScopedResponse,
  activeTradePointIdsFromScopedTradePoints,
  buildShowcaseUuidByMatrixKeyFromScopedTradePoints,
  buildTradePointExternalKeysByRopFromScopedDb,
  buildTradePointIdsByCityFromScopedDb,
  buildTradePointIdsByManagerNameFromScopedDb,
  matrixKeyForScopedTradePoint,
  NO_ROP_BUCKET_KEY,
} from "../trade-points-scoped-ids.js";

function tp(partial: Partial<ScopedTradePointDto> & Pick<ScopedTradePointDto, "id">): ScopedTradePointDto {
  return {
    externalKey: partial.externalKey ?? partial.id,
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
    teamId: null,
    teamName: null,
    ropUserId: null,
    ropFullName: null,
    ...partial,
  };
}

{
  const ids = activeTradePointIdsFromScopedTradePoints([
    tp({ id: "tp-1" }),
    tp({ id: "tp-2", isActive: false }),
  ]);
  assert.deepEqual(ids, ["tp-1"]);
}

{
  assert.equal(activeTradePointIdsFromScopedResponse(undefined), undefined);
  assert.deepEqual(
    activeTradePointIdsFromScopedResponse({ success: true, source: "db", tradePoints: [tp({ id: "tp-a" })], meta: { total: 1, scope: "team" } }),
    ["tp-a"],
  );
}

{
  const byMgr = buildTradePointIdsByManagerNameFromScopedDb([
    tp({ id: "tp-1", managerFullName: "Петров" }),
    tp({ id: "tp-2", managerFullName: "Петров" }),
    tp({ id: "tp-3", managerFullName: "  " }),
  ]);
  assert.deepEqual(byMgr.get("Петров"), ["tp-1", "tp-2"]);
  assert.equal(byMgr.has("  "), false);
}

{
  const byCity = buildTradePointIdsByCityFromScopedDb([
    tp({ id: "tp-1", city: "Казань" }),
    tp({ id: "tp-2", city: null, dealerCity: "Казань" }),
    tp({ id: "tp-3", city: "Москва" }),
  ]);
  assert.deepEqual(byCity.get("Казань"), ["tp-1", "tp-2"]);
  assert.deepEqual(byCity.get("Москва"), ["tp-3"]);
}

{
  const scoped = {
    success: true as const,
    source: "db" as const,
    tradePoints: [tp({ id: "tp-scope-1" }), tp({ id: "tp-scope-2" })],
    meta: { total: 2, scope: "team" as const },
  };
  const useReal = true;
  const actEnabled = false;
  void actEnabled;
  const scopeTradePointIds = useReal
    ? (activeTradePointIdsFromScopedResponse(scoped) ?? [])
    : [];
  assert.deepEqual(scopeTradePointIds, ["tp-scope-1", "tp-scope-2"]);
}

{
  const scopedTp = tp({
    id: "d162e083-8aa2-45a8-9500-8080eca725e6",
    externalKey: "client-ma-ma132519-01",
  });
  assert.equal(matrixKeyForScopedTradePoint(scopedTp), "client-ma-ma132519-01");
  assert.deepEqual(activeTradePointExternalKeysFromScopedTradePoints([scopedTp]), ["client-ma-ma132519-01"]);
  assert.deepEqual(activeTradePointIdsFromScopedTradePoints([scopedTp]), ["d162e083-8aa2-45a8-9500-8080eca725e6"]);
  assert.equal(activeTradePointExternalKeysFromScopedResponse(undefined), undefined);
  assert.deepEqual(
    activeTradePointExternalKeysFromScopedResponse({
      success: true,
      source: "db",
      tradePoints: [scopedTp],
      meta: { total: 1, scope: "team" },
    }),
    ["client-ma-ma132519-01"],
  );
  const inactive = tp({ id: "uuid-inactive", externalKey: "client-inactive", isActive: false });
  assert.deepEqual(activeTradePointExternalKeysFromScopedTradePoints([scopedTp, inactive]), ["client-ma-ma132519-01"]);
  const uuidByKey = buildShowcaseUuidByMatrixKeyFromScopedTradePoints([scopedTp]);
  assert.equal(uuidByKey.get("client-ma-ma132519-01"), "d162e083-8aa2-45a8-9500-8080eca725e6");
}

{
  const tradePoints = [
    tp({ id: "tp-a1", externalKey: "ek-a1", teamId: "team-b", ropFullName: "Сапожков" }),
    tp({ id: "tp-a2", externalKey: "ek-a2", teamId: "team-b", ropFullName: "Сапожков" }),
    tp({ id: "tp-b1", externalKey: "ek-b1", teamId: "team-a", ropFullName: "Купянский" }),
    tp({ id: "tp-n1", externalKey: "ek-n1", teamId: null, ropUserId: null }),
    tp({ id: "tp-skip", externalKey: "ek-skip", teamId: "team-z", isActive: false }),
  ];
  const buckets = buildTradePointExternalKeysByRopFromScopedDb(tradePoints);
  assert.equal(buckets.length, 3);
  assert.equal(buckets[0]!.ropName, "Купянский");
  assert.deepEqual(buckets[0]!.externalKeys, ["ek-b1"]);
  assert.equal(buckets[1]!.ropName, "Сапожков");
  assert.deepEqual(buckets[1]!.externalKeys, ["ek-a1", "ek-a2"]);
  assert.equal(buckets[2]!.ropKey, NO_ROP_BUCKET_KEY);
  assert.deepEqual(buckets[2]!.externalKeys, ["ek-n1"]);

  const union = buckets.flatMap((b) => b.externalKeys).sort();
  const full = activeTradePointExternalKeysFromScopedTradePoints(tradePoints).sort();
  assert.deepEqual(union, full);
  assert.equal(new Set(union).size, union.length);
}

console.log("trade-points-scoped-ids: ok");
