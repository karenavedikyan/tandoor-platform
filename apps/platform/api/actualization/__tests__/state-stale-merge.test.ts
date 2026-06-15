/**
 * Запуск: `npm run test:state-stale-merge` из каталога apps/platform.
 *
 * Промт 331: симуляция POST-пайплайна stale-merge в обработчике state.ts
 * (без полного Vercel-хэндлера — та же цепочка: incoming updatedAt → stale check → merge → trash).
 */
import assert from "node:assert/strict";
import { applyStaleStateMerge, isStaleActualizationSnapshot } from "../../../shared/actualization-merge";
import { applyTrashProtection } from "../../../shared/actualization-trash";

function extractIncomingUpdatedAt(incoming: unknown): string | null {
  return incoming != null && typeof incoming === "object" && !Array.isArray(incoming) && typeof (incoming as Record<string, unknown>).updatedAt === "string"
    ? ((incoming as Record<string, unknown>).updatedAt as string)
    : null;
}

/** Упрощённый coerceState: подмешивает пустые id-словари как в state.ts. */
function coerceState(input: unknown): Record<string, unknown> {
  const base: Record<string, unknown> = {
    archivedDealersById: {},
    archivedTradePointsById: {},
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

/**
 * Репродуцирует фрагмент POST после coerce/sanitize (manager scope):
 * stale protection → trash protection.
 */
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
  archivedDealersById: {
    "client-X": { dealerId: "client-X", archivedAt: "2026-06-10T00:00:00.000Z" },
    "client-Y": { dealerId: "client-Y", archivedAt: "2026-06-11T00:00:00.000Z" },
  },
};

// 1. POST со свежим updatedAt (≥ prev) → данные пишутся как есть, без merge.
{
  const incoming = {
    updatedAt: "2026-06-12T12:00:00.000Z",
    archivedDealersById: { "client-Z": { dealerId: "client-Z" } },
  };
  const result = simulatePostPipeline(prevState, incoming);
  assert.deepEqual(result.archivedDealersById, { "client-Z": { dealerId: "client-Z" } }, "fresh: только incoming");
  assert.ok(!("client-X" in (result.archivedDealersById as Record<string, unknown>)), "fresh: client-X не восстановлен");
}

// 2. POST со stale updatedAt (< prev) и отсутствующим client-X → запись восстанавливается.
{
  const incoming = {
    updatedAt: "2026-06-10T08:00:00.000Z",
    archivedDealersById: { "client-Z": { dealerId: "client-Z" } },
  };
  const result = simulatePostPipeline(prevState, incoming);
  const arch = result.archivedDealersById as Record<string, unknown>;
  assert.ok(arch["client-X"], "stale: client-X восстановлен");
  assert.ok(arch["client-Y"], "stale: client-Y восстановлен");
  assert.deepEqual(arch["client-Z"], { dealerId: "client-Z" }, "stale: client-Z из incoming");
}

// 3. POST без updatedAt → merge не активируется.
{
  const incoming = {
    archivedDealersById: { "client-Z": { dealerId: "client-Z" } },
  };
  const result = simulatePostPipeline(prevState, incoming);
  assert.deepEqual(result.archivedDealersById, { "client-Z": { dealerId: "client-Z" } }, "no updatedAt: без merge");
}

// 4. POST с пустым archivedDealersById = {} и stale updatedAt → все записи из prev восстанавливаются.
{
  const incoming = {
    updatedAt: "2026-06-08T00:00:00.000Z",
    archivedDealersById: {},
  };
  const result = simulatePostPipeline(prevState, incoming);
  const arch = result.archivedDealersById as Record<string, unknown>;
  assert.deepEqual(arch["client-X"], prevState.archivedDealersById["client-X"]);
  assert.deepEqual(arch["client-Y"], prevState.archivedDealersById["client-Y"]);
  assert.equal(Object.keys(arch).length, 2, "stale empty dict: оба ключа восстановлены");
}

console.log("state-stale-merge: ok (4 cases)");
