/**
 * Гидрация торговых точек из единого DB-источника в actualization-blob.
 */

import type { UnifiedActiveTradePointDetail } from "@shared/trade-point-primary";
import { reconcileDbTradePointsIntoActualizationSlice } from "@shared/trade-points-actualization-reconcile";
import {
  mergeActualizationState,
  type ActualizationState,
} from "./client-base-actualization-state.js";
import { nextManualTradePointInternalCode } from "./client-base-actualization-stable-ids.js";
import { normalizeTradePointId } from "./dealer-base-mock-data.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import { userLabelFromProfile } from "./showcase-distribution-data.js";

type ApiOk<T> = { success: true; data: T };
type ApiErr = { success: false; code?: string; message?: string };

export type UnifiedTradePointsApiData = {
  tradePoints: UnifiedActiveTradePointDetail[];
};

export async function fetchUnifiedActiveTradePointsForDealer(
  dealerId: string,
): Promise<UnifiedActiveTradePointDetail[] | null> {
  const id = dealerId.trim();
  if (!id) return null;
  try {
    const res = await fetch(
      `/api/dealers-trade-points/active-unified?dealerId=${encodeURIComponent(id)}`,
      { credentials: "include", cache: "no-store" },
    );
    const data = (await res.json()) as ApiOk<UnifiedTradePointsApiData> | ApiErr;
    if (!res.ok || !data.success) return null;
    return data.data.tradePoints;
  } catch {
    return null;
  }
}

function assignInternalCodesForNewManualTradePoints(
  prev: ActualizationState,
  manualById: ActualizationState["manuallyCreatedTradePointsById"],
): ActualizationState["manuallyCreatedTradePointsById"] {
  let nextState = prev;
  const out = { ...manualById };
  for (const [id, rec] of Object.entries(out)) {
    if (prev.manuallyCreatedTradePointsById[id]) continue;
    const ic = (rec.internalCode ?? "").trim();
    if (/^TND-TP-\d{6}$/i.test(ic)) continue;
    const code = nextManualTradePointInternalCode(nextState);
    out[id] = { ...rec, internalCode: code };
    nextState = mergeActualizationState(nextState, {
      manuallyCreatedTradePointsById: { ...nextState.manuallyCreatedTradePointsById, [id]: out[id]! },
    });
  }
  return out;
}

/** Реконсиляция DB-строк в срез actualization-state (чистая функция). */
export function reconcileUnifiedTradePointsIntoActualizationState(
  prev: ActualizationState,
  dbRows: UnifiedActiveTradePointDetail[],
  dealerId: string,
  profile: ReleaseDemoProfile,
  now = new Date().toISOString(),
): { next: ActualizationState; changed: boolean } {
  const actor = {
    userId: profile.personaUserId,
    userName: userLabelFromProfile(profile),
  };
  const result = reconcileDbTradePointsIntoActualizationSlice(
    {
      manuallyCreatedTradePointsById: prev.manuallyCreatedTradePointsById,
      tradePointOverridesById: prev.tradePointOverridesById,
      trashedTradePointsById: prev.trashedTradePointsById,
    },
    dbRows,
    dealerId,
    actor,
    now,
  );
  if (!result.changed) return { next: prev, changed: false };

  const manualWithCodes = assignInternalCodesForNewManualTradePoints(
    prev,
    result.manuallyCreatedTradePointsById,
  );

  return {
    next: mergeActualizationState(prev, {
      manuallyCreatedTradePointsById: manualWithCodes,
      tradePointOverridesById: result.tradePointOverridesById,
    }),
    changed: true,
  };
}

export function unifiedDbTradePointIds(rows: UnifiedActiveTradePointDetail[] | null | undefined): string[] {
  if (!rows?.length) return [];
  return rows.map((r) => r.tpId);
}

/** Найти точку в ответе единого DB-источника по id маршрута. */
export function findUnifiedTradePointInDbRows(
  dbRows: UnifiedActiveTradePointDetail[],
  dealerId: string,
  rawPointId: string,
): UnifiedActiveTradePointDetail | undefined {
  const pid = rawPointId.trim();
  if (!pid) return undefined;
  const normalized = normalizeTradePointId(dealerId, pid);
  return dbRows.find((r) => r.tpId === pid || r.tpId === normalized);
}

/** Реконсиляция активных ТТ дилера из БД в actualization-store (как в хуке гидрации). */
export async function hydrateDealerTradePointsFromDb(args: {
  dealerId: string;
  profile: ReleaseDemoProfile;
  persist: (mutate: (prev: ActualizationState) => ActualizationState) => Promise<{ success: boolean }>;
}): Promise<{ rows: UnifiedActiveTradePointDetail[] | null; changed: boolean }> {
  const id = args.dealerId.trim();
  if (!id) return { rows: null, changed: false };
  const rows = await fetchUnifiedActiveTradePointsForDealer(id);
  if (!rows || rows.length === 0) return { rows, changed: false };

  let changed = false;
  await args.persist((prev) => {
    const r = reconcileUnifiedTradePointsIntoActualizationState(prev, rows, id, args.profile);
    changed = r.changed;
    return r.changed ? r.next : prev;
  });
  return { rows, changed };
}
