/**
 * Запуск: `npm run test:state-stale-merge` из каталога apps/platform.
 *
 * Промт 331: симуляция POST-пайплайна stale-merge в обработчике state.ts.
 */
import assert from "node:assert/strict";
import { applyStaleStateMerge, isStaleActualizationSnapshot } from "../../../shared/actualization-merge";
import { applyTrashProtection } from "../../../shared/actualization-trash";

function extractIncomingUpdatedAt(incoming: unknown): string | null {
  return incoming != null && typeof incoming === "object" && !Array.isArray(incoming) && typeof (incoming as Record<string, unknown>).updatedAt === "string"
    ? ((incoming as Record<string, unknown>).updatedAt as string)
    : null;
}

function coerceState(input: unknown): Record<string, unknown> {
  const base: Record<string, unknown> = {
    archivedLegalEntitiesById: {},
    archivedDealerContactsById: {},
    dealerOverridesById: {},
    manuallyCreatedDealersById: {},
    tradePointOverridesById: {},
    manuallyCreatedTradePointsById: {},
    legalEntityOverridesByDealerId: {},
    dealerActualizationContactsById: {},
    dealerActualizationAuditByDealerId: {},
    unloadingOrderByDealerId: {},
    dealerPhotosByDealerId: {},
    tradePointPhotosByTradePointId: {},
    tradePointShowcaseActualizationById: {},
    trashedDealersById: {},
    trashedTradePointsById: {},
  };
  if (input == null || typeof input !== "object" || Array.isArray(input)) return { ...base };
  const merged = { ...base, ...(input as Record<string, unknown>) };
  for (const k of Object.keys(base)) {
    const v = merged[k];
    if (v != null && typeof v === "object" && !Array.isArray(v)) continue;
    merged[k] = base[k];
  }
  return merged;
}

function simulatePostPipeline(
  prevState: Record<string, unknown> | null,
  bodyState: Record<string, unknown>,
): Record<string, unknown> {
  const incomingUpdatedAt = extractIncomingUpdatedAt(bodyState);
  const sanitizedNext = coerceState(bodyState);
  sanitizedNext.updatedAt = new Date().toISOString();
  sanitizedNext.updatedBy = "test-user";

  if (isStaleActualizationSnapshot(prevState, incomingUpdatedAt)) {
    applyStaleStateMerge(prevState, sanitizedNext);
  }
  applyTrashProtection(prevState, sanitizedNext, null);
  return sanitizedNext;
}

const prevFresh = "2026-06-12T10:00:00.000Z";
const prevState = {
  updatedAt: prevFresh,
  trashedDealersById: {
    "client-X": { dealerId: "client-X", trashedAt: "2026-06-10T00:00:00.000Z" },
    "client-Y": { dealerId: "client-Y", trashedAt: "2026-06-11T00:00:00.000Z" },
  },
};

{
  const incoming = {
    updatedAt: "2026-06-12T12:00:00.000Z",
    trashedDealersById: { "client-Z": { dealerId: "client-Z" } },
  };
  const result = simulatePostPipeline(prevState, incoming);
  const trash = result.trashedDealersById as Record<string, unknown>;
  assert.deepEqual(trash["client-Z"], { dealerId: "client-Z" }, "fresh: incoming client-Z");
  assert.ok(trash["client-X"], "fresh: trash protection восстанавливает client-X");
  assert.ok(trash["client-Y"], "fresh: trash protection восстанавливает client-Y");
}

{
  const incoming = {
    updatedAt: "2026-06-10T08:00:00.000Z",
    trashedDealersById: { "client-Z": { dealerId: "client-Z" } },
  };
  const result = simulatePostPipeline(prevState, incoming);
  const trash = result.trashedDealersById as Record<string, unknown>;
  assert.ok(trash["client-X"], "stale: client-X восстановлен");
  assert.ok(trash["client-Y"], "stale: client-Y восстановлен");
  assert.deepEqual(trash["client-Z"], { dealerId: "client-Z" }, "stale: client-Z из incoming");
}

{
  const incoming = {
    trashedDealersById: { "client-Z": { dealerId: "client-Z" } },
  };
  const result = simulatePostPipeline(prevState, incoming);
  const trash = result.trashedDealersById as Record<string, unknown>;
  assert.ok(trash["client-Z"], "no updatedAt: client-Z из incoming");
  assert.ok(trash["client-X"], "no updatedAt: trash protection client-X");
}

{
  const incoming = {
    updatedAt: "2026-06-08T00:00:00.000Z",
    trashedDealersById: {},
  };
  const result = simulatePostPipeline(prevState, incoming);
  const trash = result.trashedDealersById as Record<string, unknown>;
  assert.deepEqual(trash["client-X"], prevState.trashedDealersById["client-X"]);
  assert.deepEqual(trash["client-Y"], prevState.trashedDealersById["client-Y"]);
  assert.equal(Object.keys(trash).length, 2, "stale empty dict: оба ключа восстановлены");
}

console.log("state-stale-merge: ok (4 cases)");
