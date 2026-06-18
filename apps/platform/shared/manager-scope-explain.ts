/**
 * GET /api/diag/manager-scope-explain — пошаговый пайплайн scope менеджера (Промт 394).
 */

import type { PoolLike } from "./admin/admin-auth.js";
import { computeDbScopeForUser, resolveScopeCodesMeta } from "./db-scope-formula.js";
import { handleDealersTradePointsList } from "./dealers-trade-points-handlers.js";
import type { DealerRow } from "../client/src/lib/dealer-base-mock-data.js";

export type ManagerScopeExplainDropped = {
  releaseCode: string | null;
  name: string;
  reason: string;
};

export type ManagerScopeExplainResult = {
  step0_clientAssignments: number;
  step1_visibleCodes: number;
  step2_catalogRows: number;
  step3_afterVisibleFilter: number;
  step4_afterAssignmentsScope: number;
  step5_afterActualizationMerge: number;
  step6_afterTrashInvariant: number;
  step7_afterPickerFilters: number;
  droppedAtStep: string | null;
  droppedDealers: ManagerScopeExplainDropped[];
};

function normalizeCode(raw: string): string {
  const t = raw.trim();
  const PREFIX = "client-";
  const body = t.startsWith(PREFIX) ? t.slice(PREFIX.length) : t;
  return body.toUpperCase();
}

function rowMatchesCodes(row: DealerRow, codes: Set<string>): boolean {
  const normalized = new Set(Array.from(codes).map(normalizeCode));
  const candidates = [row.releaseCode, row.external1cCode, row.id].filter(Boolean) as string[];
  return candidates.some((c) => normalized.has(normalizeCode(c)));
}

function filterByExternalKeys(rows: DealerRow[], keys: Set<string>): DealerRow[] {
  if (keys.size === 0) return rows;
  return rows.filter((r) => keys.has(r.id));
}

function filterAssignmentsScope(rows: DealerRow[], ownCodes: string[]): DealerRow[] {
  const own = new Set(ownCodes);
  return rows.filter((r) => rowMatchesCodes(r, own));
}

function filterQuickAll(rows: DealerRow[]): DealerRow[] {
  return rows.filter((r) => r.status !== "приостановлен");
}

function diffDropped(
  before: DealerRow[],
  after: DealerRow[],
  reason: string,
  limit = 20,
): ManagerScopeExplainDropped[] {
  const afterIds = new Set(after.map((r) => r.id));
  const out: ManagerScopeExplainDropped[] = [];
  for (const r of before) {
    if (afterIds.has(r.id)) continue;
    out.push({
      releaseCode: r.releaseCode ?? null,
      name: r.name,
      reason,
    });
    if (out.length >= limit) break;
  }
  return out;
}

function firstDropStep(
  counts: Record<string, number>,
  expected: number,
): string | null {
  const order = [
    "step3_afterVisibleFilter",
    "step4_afterAssignmentsScope",
    "step5_afterActualizationMerge",
    "step6_afterTrashInvariant",
    "step7_afterPickerFilters",
  ];
  for (const step of order) {
    if (counts[step]! < expected) return step;
  }
  return null;
}

export async function buildManagerScopeExplain(
  pool: PoolLike,
  userId: string,
  role: string,
): Promise<ManagerScopeExplainResult> {
  const ownQ = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM (
       SELECT DISTINCT client_code FROM client_assignments WHERE responsible_user_id = $1::uuid
     ) t`,
    [userId],
  );
  const step0 = Number(ownQ.rows[0]?.n ?? 0);

  const codesMeta = await resolveScopeCodesMeta(pool, userId, role as import("./auth.js").UserRole);
  const step1 = codesMeta.allCodes.length;

  const catalog = await handleDealersTradePointsList(pool, {});
  const step2 = catalog.dealers.length;

  const dbScope = await computeDbScopeForUser(pool, userId, role as import("./auth.js").UserRole);
  const externalKeys = new Set(dbScope.active_dealer_external_keys);

  const step3Rows = filterByExternalKeys(catalog.dealers, externalKeys);
  const step3 = step3Rows.length;

  const step4Rows = filterAssignmentsScope(step3Rows, codesMeta.ownCodes);
  const step4 = step4Rows.length;

  // На сервере нет client actualization merge — шаг 5 = 4 (рабочая база без архива в UI).
  const step5Rows = step4Rows;
  const step5 = step5Rows.length;

  const trashedKeys = new Set(dbScope.trashed_dealer_external_keys);
  const step6Rows = step5Rows.filter((r) => !trashedKeys.has(r.id));
  const step6 = step6Rows.length;

  const step7Rows = filterQuickAll(step6Rows);
  const step7 = step7Rows.length;

  const expected = step0;
  const counts = {
    step3_afterVisibleFilter: step3,
    step4_afterAssignmentsScope: step4,
    step5_afterActualizationMerge: step5,
    step6_afterTrashInvariant: step6,
    step7_afterPickerFilters: step7,
  };
  const droppedAtStep = firstDropStep(counts, expected);

  let droppedDealers: ManagerScopeExplainDropped[] = [];
  if (droppedAtStep === "step3_afterVisibleFilter") {
    const visByCodes = filterAssignmentsScope(catalog.dealers, codesMeta.ownCodes);
    droppedDealers = diffDropped(visByCodes, step3Rows, "missing external_key in db scope");
  } else if (droppedAtStep === "step4_afterAssignmentsScope") {
    droppedDealers = diffDropped(step3Rows, step4Rows, "code mismatch in assignments scope");
  } else if (droppedAtStep === "step6_afterTrashInvariant") {
    droppedDealers = diffDropped(step5Rows, step6Rows, "trashed in dealer_overrides");
  } else if (droppedAtStep === "step7_afterPickerFilters") {
    droppedDealers = diffDropped(step6Rows, step7Rows, "quick filter (приостановлен)");
  }

  return {
    step0_clientAssignments: step0,
    step1_visibleCodes: step1,
    step2_catalogRows: step2,
    step3_afterVisibleFilter: step3,
    step4_afterAssignmentsScope: step4,
    step5_afterActualizationMerge: step5,
    step6_afterTrashInvariant: step6,
    step7_afterPickerFilters: step7,
    droppedAtStep,
    droppedDealers,
  };
}
