/**
 * Скоуп корзины — симметрия рабочей базы (Промт 336).
 *
 * Фильтр строится из того же `SidebarNavRealScope`, что и счётчики /dealer-base
 * (`roleScopedDealerRowsForReal` + `assignmentsScope`).
 */

import type { UserRole } from "@shared/auth";
import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { normalizeDealerId } from "@/lib/dealer-base-mock-data";
import {
  assignmentsScopeIsActive,
  roleScopedDealerRowsForReal,
  type AssignmentsScope,
} from "@/lib/dealer-base-real-scope";
import type { DealerBaseAccessRole } from "@/lib/dealer-base-role-views";
import type { ReleaseDemoProfile } from "@/lib/release-demo-profile";
import type { SidebarNavRealScope } from "@/lib/sidebar-nav-real-scope";
import type { TrashedDealerInfo, TrashedTradePointInfo } from "@/lib/client-base-actualization-state";

export type TrashScopeFilter = {
  isDealerInScope: (dealerId: string) => boolean;
  isTradePointInScope: (tpId: string, dealerId: string | null) => boolean;
  /** Полный обход фильтра — admin/director/category_manager и demo-режим без real-данных. */
  fullView: boolean;
};

const FULL_VIEW_ROLES: ReadonlySet<UserRole> = new Set(["admin", "director", "category_manager"]);

function dealerKeysForRow(row: DealerRow): string[] {
  const keys = new Set<string>([row.id, normalizeDealerId(row.id)]);
  const code = row.releaseCode?.trim();
  if (code) {
    keys.add(code);
    keys.add(code.toUpperCase());
    keys.add(`client-${code}`);
    keys.add(`client-${code.toUpperCase()}`);
  }
  return [...keys];
}

function normalizeTrashDealerKeys(dealerId: string): string[] {
  const t = dealerId.trim();
  const keys = new Set<string>([t, normalizeDealerId(t)]);
  const withoutClient = t.replace(/^client-/i, "");
  if (withoutClient && withoutClient !== t) {
    keys.add(withoutClient);
    keys.add(withoutClient.toUpperCase());
  }
  return [...keys];
}

function keysMatchAssignmentsScope(keys: string[], codes: Set<string>): boolean {
  for (const k of keys) {
    if (codes.has(k)) return true;
  }
  return false;
}

function dealerIdInAssignmentsScope(
  dealerId: string,
  scope: AssignmentsScope,
  access: DealerBaseAccessRole,
): boolean {
  const keys = normalizeTrashDealerKeys(dealerId);
  const granted = scope.grantedCodes;
  if (access === "team_lead") {
    return (
      keysMatchAssignmentsScope(keys, scope.teamCodes) ||
      keysMatchAssignmentsScope(keys, scope.ownCodes) ||
      (granted ? keysMatchAssignmentsScope(keys, granted) : false)
    );
  }
  return (
    keysMatchAssignmentsScope(keys, scope.ownCodes) ||
    (granted ? keysMatchAssignmentsScope(keys, granted) : false)
  );
}

export type TrashScopeAllowedSets = {
  dealerKeys: Set<string>;
  access: DealerBaseAccessRole;
  assignmentsScope?: AssignmentsScope;
};

/** Для тестов и отладки: множества ключей дилеров в scope (как у рабочей базы). */
export function buildTrashScopeAllowedSets(realScope: SidebarNavRealScope | undefined): TrashScopeAllowedSets | null {
  if (!realScope?.ready || !realScope.orgScope || !realScope.releaseDealerRows) return null;

  const scopedRows = roleScopedDealerRowsForReal(
    realScope.releaseDealerRows,
    realScope.orgScope.snap,
    realScope.orgScope.access,
    undefined,
    realScope.assignmentsScope,
  );

  const dealerKeys = new Set<string>();
  for (const row of scopedRows) {
    for (const k of dealerKeysForRow(row)) dealerKeys.add(k);
  }

  return {
    dealerKeys,
    access: realScope.orgScope.access,
    assignmentsScope: realScope.assignmentsScope,
  };
}

function isRealScopeReadyForTrash(realScope: SidebarNavRealScope | undefined): boolean {
  return Boolean(realScope?.isRealUser && realScope.ready && realScope.orgScope);
}

export function buildTrashScopeFilter(opts: {
  role: UserRole | null;
  profile: ReleaseDemoProfile;
  realScope: SidebarNavRealScope | undefined;
}): TrashScopeFilter {
  const { role, realScope } = opts;

  // Демо / пока real-scope не готов — не сужаем (совместимость с демо-сценариями и Промтом 332).
  if (!isRealScopeReadyForTrash(realScope)) {
    return { isDealerInScope: () => true, isTradePointInScope: () => true, fullView: true };
  }

  if (role && FULL_VIEW_ROLES.has(role)) {
    return { isDealerInScope: () => true, isTradePointInScope: () => true, fullView: true };
  }

  const allowed = buildTrashScopeAllowedSets(realScope);
  if (!allowed) {
    return {
      isDealerInScope: () => false,
      isTradePointInScope: () => false,
      fullView: false,
    };
  }

  const { dealerKeys, access, assignmentsScope } = allowed;

  const isDealerInScope = (dealerId: string): boolean => {
    for (const k of normalizeTrashDealerKeys(dealerId)) {
      if (dealerKeys.has(k)) return true;
    }
    if (assignmentsScope && assignmentsScopeIsActive(assignmentsScope)) {
      return dealerIdInAssignmentsScope(dealerId, assignmentsScope, access);
    }
    return false;
  };

  return {
    isDealerInScope,
    isTradePointInScope: (tpId, dealerId) => {
      if (dealerId && isDealerInScope(dealerId)) return true;
      return isDealerInScope(tpId);
    },
    fullView: false,
  };
}

export function countScopedTrashItems(
  dealers: Record<string, TrashedDealerInfo>,
  tps: Record<string, TrashedTradePointInfo>,
  filter: TrashScopeFilter,
): number {
  if (filter.fullView) {
    return Object.keys(dealers).length + Object.keys(tps).length;
  }
  let n = 0;
  for (const id of Object.keys(dealers)) {
    if (filter.isDealerInScope(id)) n++;
  }
  for (const tpId of Object.keys(tps)) {
    const dealerId = tps[tpId]?.dealerId ?? null;
    if (filter.isTradePointInScope(tpId, dealerId)) n++;
  }
  return n;
}
