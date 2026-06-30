/**
 * Запуск: npx tsx client/src/hooks/__tests__/use-trade-points-actualization-hydration.test.ts
 */
import assert from "node:assert/strict";
import type { UnifiedActiveTradePointDetail } from "@shared/trade-point-primary";
import { primaryTradePointMaterializationId } from "@shared/primary-trade-point-materialization";
import { createEmptyActualizationState } from "../../lib/client-base-actualization-state.js";
import type { ReleaseDemoProfile } from "../../lib/release-demo-profile.js";
import {
  executeTradePointsDbHydration,
  releaseTradePointsHydrationAttemptOnCancel,
  scheduleHydrationReadyFallback,
  shouldSkipTradePointsHydrationFetch,
} from "../use-trade-points-actualization-hydration.js";

const profile = { personaUserId: "u1", personaUserName: "Тест" } as ReleaseDemoProfile;
const dealerId = "client-ma-ma120571";
const tpId = primaryTradePointMaterializationId(dealerId);

const balyukDbRow: UnifiedActiveTradePointDetail = {
  tpId,
  dealerId,
  name: "Основная торговая точка",
  city: "Луганск",
  address: "Адрес не указан",
  contactName: null,
  contactPhone: null,
  comment: null,
  showcaseStatus: null,
  format: "Розница / салон",
  isPrimary: false,
  isOverrideOnly: true,
  hasOverrideRow: true,
  updatedAt: "2026-06-16T10:00:00.000Z",
  updatedBy: "u-db",
};

// rerun-without-completion: гонка как при смене persist до завершения fetch
{
  const attemptedRef = { current: null as string | null };
  const id = "client-race-test";
  let cancelled = false;
  let completed = false;
  let resolveFetch: (rows: UnifiedActiveTradePointDetail[]) => void;
  const fetchPromise = new Promise<UnifiedActiveTradePointDetail[]>((resolve) => {
    resolveFetch = resolve;
  });
  let fetchCount = 0;
  let ready = false;

  const run1 = executeTradePointsDbHydration({
    id,
    attemptedRef,
    isCancelled: () => cancelled,
    fetchRows: async () => {
      fetchCount += 1;
      return fetchPromise;
    },
    persist: async (mutate) => {
      mutate(createEmptyActualizationState());
      return { success: true };
    },
    actState: createEmptyActualizationState(),
    profile,
    onRows: () => {},
    markCompleted: () => {
      completed = true;
      ready = true;
    },
  });

  await Promise.resolve();
  assert.equal(attemptedRef.current, id);
  cancelled = true;
  releaseTradePointsHydrationAttemptOnCancel(attemptedRef, id, completed);
  assert.equal(attemptedRef.current, null);

  cancelled = false;
  completed = false;
  const ok2 = await executeTradePointsDbHydration({
    id,
    attemptedRef,
    isCancelled: () => cancelled,
    fetchRows: async () => {
      fetchCount += 1;
      return [balyukDbRow];
    },
    persist: async (mutate) => {
      mutate(createEmptyActualizationState());
      return { success: true };
    },
    actState: createEmptyActualizationState(),
    profile,
    onRows: () => {},
    markCompleted: () => {
      completed = true;
      ready = true;
    },
  });

  resolveFetch!([balyukDbRow]);
  await run1;

  assert.equal(ok2, true);
  assert.equal(ready, true, "после рестарта effect ready наступает");
  assert.equal(fetchCount, 2);
}

// rerun-without-completion: отмена до завершения сбрасывает attemptedRef
{
  const attemptedRef = { current: null as string | null };
  let completed = false;
  const id = "client-rerun-test";

  assert.equal(shouldSkipTradePointsHydrationFetch(attemptedRef, id, false), false);
  attemptedRef.current = id;

  releaseTradePointsHydrationAttemptOnCancel(attemptedRef, id, completed);
  assert.equal(attemptedRef.current, null, "после отмены attemptedRef сброшен");

  let fetchCount = 0;
  let ready = false;

  const ok = await executeTradePointsDbHydration({
    id,
    attemptedRef,
    isCancelled: () => false,
    fetchRows: async () => {
      fetchCount += 1;
      return [balyukDbRow];
    },
    persist: async (mutate) => {
      mutate(createEmptyActualizationState());
      return { success: true };
    },
    actState: createEmptyActualizationState(),
    profile,
    onRows: () => {},
    markCompleted: () => {
      completed = true;
      ready = true;
    },
  });
  assert.equal(ok, true);
  assert.equal(ready, true, "повторный запуск после отмены доводит до ready");
  assert.equal(fetchCount, 1);
}

// idempotent: после успешного завершения повтор без force не fetch-ит
{
  const attemptedRef = { current: null as string | null };
  let fetchCount = 0;
  const rowsOut: UnifiedActiveTradePointDetail[] = [];

  const ok1 = await executeTradePointsDbHydration({
    id: dealerId,
    attemptedRef,
    isCancelled: () => false,
    fetchRows: async () => {
      fetchCount += 1;
      return [balyukDbRow];
    },
    persist: async (mutate) => {
      mutate(createEmptyActualizationState());
      return { success: true };
    },
    actState: createEmptyActualizationState(),
    profile,
    onRows: (rows) => {
      rowsOut.push(...rows);
    },
    markCompleted: () => {},
  });
  assert.equal(ok1, true);
  assert.equal(fetchCount, 1);

  const ok2 = await executeTradePointsDbHydration({
    id: dealerId,
    attemptedRef,
    isCancelled: () => false,
    fetchRows: async () => {
      fetchCount += 1;
      return [balyukDbRow];
    },
    persist: async (mutate) => {
      mutate(createEmptyActualizationState());
      return { success: true };
    },
    actState: createEmptyActualizationState(),
    profile,
    onRows: () => {},
    markCompleted: () => {},
  });
  assert.equal(ok2, false, "повтор без force пропускает fetch");
  assert.equal(fetchCount, 1, "идемпотентно — один fetch");
  assert.ok(rowsOut.some((r) => r.tpId === tpId));
}

// override-only Балюк
{
  const attemptedRef = { current: null as string | null };
  const rowsOut: UnifiedActiveTradePointDetail[] = [];
  let ready = false;

  const ok = await executeTradePointsDbHydration({
    id: dealerId,
    attemptedRef,
    isCancelled: () => false,
    fetchRows: async () => [balyukDbRow],
    persist: async (mutate) => {
      mutate(createEmptyActualizationState());
      return { success: true };
    },
    actState: createEmptyActualizationState(),
    profile,
    onRows: (rows) => {
      rowsOut.push(...rows);
    },
    markCompleted: () => {
      ready = true;
    },
  });
  assert.equal(ok, true);
  assert.equal(ready, true);
  assert.equal(rowsOut.length, 1);
  assert.equal(rowsOut[0]?.tpId, tpId);
  assert.equal(rowsOut[0]?.isOverrideOnly, true);
}

// timeout fallback
{
  let cancelled = false;
  const readySetRef = { current: false };
  let ready = false;

  const clear = scheduleHydrationReadyFallback({
    timeoutMs: 30,
    isCancelled: () => cancelled,
    isReadySet: () => readySetRef.current,
    onFallback: () => {
      readySetRef.current = true;
      ready = true;
    },
  });

  await new Promise((r) => setTimeout(r, 50));
  assert.equal(ready, true, "таймаут выставляет ready");
  clear();
  cancelled = true;
}

// no-writeback: persist не вызывается, read-path заполнен
{
  const attemptedRef = { current: null as string | null };
  const rowsOut: UnifiedActiveTradePointDetail[] = [];
  let idsOut: string[] = [];
  let persistCalls = 0;
  let ready = false;

  const actState = createEmptyActualizationState();
  actState.manuallyCreatedTradePointsById = {
    "manual-tp-1": {
      id: "manual-tp-1",
      dealerId,
      internalCode: "TND-TP-000099",
      fields: { name: "Ручная ТТ" },
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "u1",
      createdByName: "Тест",
      source: "manual_actualization",
    },
  };
  actState.trashedTradePointsById = {
    "trashed-tp": {
      tradePointId: "trashed-tp",
      dealerId,
      trashedAt: "2026-01-01T00:00:00.000Z",
      trashedBy: "u1",
      trashedByName: "Тест",
      expiresAt: "2026-01-15T00:00:00.000Z",
      source: "client_card_delete",
      snapshot: { name: "X", address: null, city: null, tradePointCode: null, dealerFullName: null },
    },
  };
  const manualBefore = actState.manuallyCreatedTradePointsById["manual-tp-1"];
  const trashBefore = actState.trashedTradePointsById["trashed-tp"];

  const ok = await executeTradePointsDbHydration({
    id: dealerId,
    attemptedRef,
    isCancelled: () => false,
    noWriteback: true,
    fetchRows: async () => [balyukDbRow],
    persist: async () => {
      persistCalls += 1;
      return { success: true };
    },
    actState,
    profile,
    onRows: (rows, ids) => {
      rowsOut.push(...rows);
      idsOut = ids;
    },
    markCompleted: () => {
      ready = true;
    },
  });

  assert.equal(ok, true);
  assert.equal(persistCalls, 0, "no-writeback: persist не вызывается");
  assert.equal(ready, true);
  assert.equal(rowsOut.length, 1);
  assert.deepEqual(idsOut, [tpId]);
  assert.equal(actState.manuallyCreatedTradePointsById["manual-tp-1"], manualBefore);
  assert.equal(actState.trashedTradePointsById["trashed-tp"], trashBefore);
}

// no-writeback off: persist вызывается (регрессия legacy)
{
  const attemptedRef = { current: null as string | null };
  let persistCalls = 0;

  const ok = await executeTradePointsDbHydration({
    id: dealerId,
    attemptedRef,
    isCancelled: () => false,
    noWriteback: false,
    fetchRows: async () => [balyukDbRow],
    persist: async (mutate) => {
      persistCalls += 1;
      mutate(createEmptyActualizationState());
      return { success: true };
    },
    actState: createEmptyActualizationState(),
    profile,
    onRows: () => {},
    markCompleted: () => {},
  });

  assert.equal(ok, true);
  assert.equal(persistCalls, 1, "legacy: persist вызывается при rows.length > 0");
}

// no-writeback: рестарт effect после отмены — ready наступает, persist не вызывается
{
  const attemptedRef = { current: null as string | null };
  let completed = false;
  const id = "client-no-writeback-rerun";
  let persistCalls = 0;

  assert.equal(shouldSkipTradePointsHydrationFetch(attemptedRef, id, false), false);
  attemptedRef.current = id;
  releaseTradePointsHydrationAttemptOnCancel(attemptedRef, id, completed);

  let ready = false;
  const ok = await executeTradePointsDbHydration({
    id,
    attemptedRef,
    isCancelled: () => false,
    noWriteback: true,
    fetchRows: async () => [balyukDbRow],
    persist: async () => {
      persistCalls += 1;
      return { success: true };
    },
    actState: createEmptyActualizationState(),
    profile,
    onRows: () => {},
    markCompleted: () => {
      completed = true;
      ready = true;
    },
  });
  assert.equal(ok, true);
  assert.equal(ready, true);
  assert.equal(persistCalls, 0);
}

console.log("use-trade-points-actualization-hydration: ok");
