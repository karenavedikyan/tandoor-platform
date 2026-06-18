/**
 * Скоуп корзины — симметрия рабочей базы (Промт 336).
 * Промт 396: персональный trash-state менеджера/РОП/РМ не фильтруется;
 * архив фильтруется отдельно через buildArchiveScopeFilter.
 */

import type { UserRole } from "@shared/auth";
import type { DealerRow } from "./dealer-base-mock-data.js";
import { normalizeDealerId } from "./dealer-base-mock-data.js";
import {
  assignmentsScopeIsActive,
  roleScopedDealerRowsForReal,
  type AssignmentsScope,
} from "./dealer-base-real-scope.js";
import type { DealerBaseAccessRole } from "./dealer-base-role-views.js";
import type { ReleaseDemoProfile } from "./release-demo-profile.js";
import type { SidebarNavRealScope } from "./sidebar-nav-real-scope.js";
import type { TrashedDealerInfo, TrashedTradePointInfo } from "./client-base-actualization-state.js";

export type TrashScopeFilter = {
  isDealerInScope: (dealerId: string) => boolean;
  isTradePointInScope: (tpId: string, dealerId: string | null) => boolean;
  /** Полный обход фильтра — admin/director/category_manager и demo-режим без real-данных. */
  fullView: boolean;
};

const FULL_VIEW_ROLES: ReadonlySet<UserRole> = new Set(["admin", "director", "category_manager"]);

/** Промт 396: корзина в персональном jsonb-state — только свои удаления, фильтр не нужен. */
const PERSONAL_TRASH_ROLES: ReadonlySet<UserRole> = new Set(["manager", "regional_manager", "rop"]);

const FULL_VIEW_FILTER: TrashScopeFilter = {
  isDealerInScope: () => true,
  isTradePointInScope: () => true,
  fullView: true,
};

const EMPTY_FILTER: TrashScopeFilter = {
  isDealerInScope: () => false,
  isTradePointInScope: () => false,
  fullView: false,
};

function dealerKeysForRow(row: DealerRow): string[] {
  const keys = new Set<string>([row.id, normalizeDealerId(row.id)]);
  const code = row.releaseCode?.trim();
  if (code) {
    keys.add(code);
    keys.add(code.toUpperCase());
    keys.add(code.toLowerCase());
    keys.add(`client-${code}`);
    keys.add(`client-${code.toUpperCase()}`);
    keys.add(`client-${code.toLowerCase()}`);
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
    keys.add(withoutClient.toLowerCase());
  }
  return [...keys];
}

function keysMatchAssignmentsScope(keys: string[], codes: Set<string>): boolean {
  const normalizedCodes = new Set<string>();
  for (const raw of codes) {
    const c = raw.trim();
    if (!c) continue;
    normalizedCodes.add(c);
    normalizedCodes.add(c.toUpperCase());
    normalizedCodes.add(c.toLowerCase());
    const without = c.replace(/^client-/i, "");
    if (without !== c) {
      normalizedCodes.add(without);
      normalizedCodes.add(without.toUpperCase());
      normalizedCodes.add(without.toLowerCase());
    }
  }
  for (const k of keys) {
    if (normalizedCodes.has(k) || normalizedCodes.has(k.toUpperCase()) || normalizedCodes.has(k.toLowerCase())) {
      return true;
    }
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

function buildScopedFilterFromAllowed(allowed: TrashScopeAllowedSets): TrashScopeFilter {
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

export function buildTrashScopeFilter(opts: {
  role: UserRole | null;
  profile: ReleaseDemoProfile;
  realScope: SidebarNavRealScope | undefined;
}): TrashScopeFilter {
  const { role, realScope } = opts;

  // Демо / пока real-scope не готов — не сужаем (совместимость с демо-сценариями и Промтом 332).
  if (!isRealScopeReadyForTrash(realScope)) {
    return FULL_VIEW_FILTER;
  }

  if (role && FULL_VIEW_ROLES.has(role)) {
    return FULL_VIEW_FILTER;
  }

  // Промт 396: персональный state корзины — только свои удаления.
  if (role && PERSONAL_TRASH_ROLES.has(role)) {
    return FULL_VIEW_FILTER;
  }

  const allowed = buildTrashScopeAllowedSets(realScope);
  if (!allowed) {
    return FULL_VIEW_FILTER;
  }

  if (
    allowed.dealerKeys.size === 0 &&
    (!allowed.assignmentsScope || !assignmentsScopeIsActive(allowed.assignmentsScope))
  ) {
    return FULL_VIEW_FILTER;
  }

  return buildScopedFilterFromAllowed(allowed);
}

/** Архив: сужение по scope (ownCodes/grantedCodes); для менеджера НЕ fullView. */
export function buildArchiveScopeFilter(opts: {
  role: UserRole | null;
  profile: ReleaseDemoProfile;
  realScope: SidebarNavRealScope | undefined;
}): TrashScopeFilter {
  const { role, realScope } = opts;

  if (!isRealScopeReadyForTrash(realScope)) {
    return FULL_VIEW_FILTER;
  }

  if (role && FULL_VIEW_ROLES.has(role)) {
    return FULL_VIEW_FILTER;
  }

  const allowed = buildTrashScopeAllowedSets(realScope);
  if (!allowed) {
    return EMPTY_FILTER;
  }

  if (
    allowed.dealerKeys.size === 0 &&
    (!allowed.assignmentsScope || !assignmentsScopeIsActive(allowed.assignmentsScope))
  ) {
    return EMPTY_FILTER;
  }

  return buildScopedFilterFromAllowed(allowed);
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
