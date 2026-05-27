/**
 * РОП / менеджер строки клиентской базы для фокус-просмотра (drilldown /main/rop, /main/manager).
 */

import type { DealerRow } from "@/lib/dealer-base-mock-data";
import { ropUserForManager } from "@/lib/dealer-base-real-scope";
import { managerDisplayMatchesCatalogName } from "@/lib/rop-manager-filters";
import type { OrgSnapshot, OrgSnapshotUser } from "@/lib/use-org-snapshot";
import { MGR_TO_UUID_FOR_ACTUALIZATION_DEDUPE } from "@shared/admin/actualization-dedupe";

export type RowHierarchyMeta = {
  manager: OrgSnapshotUser | null;
  managerUserId: string | null;
  rop: OrgSnapshotUser | null;
  ropUserId: string | null;
};

function resolveManagerUserIdFromRow(row: DealerRow, snap: OrgSnapshot): string | null {
  const rel = row.releaseManagerId?.trim();
  if (rel) {
    if (snap.users.some((u) => u.id === rel)) return rel;
    const fromCatalog = MGR_TO_UUID_FOR_ACTUALIZATION_DEDUPE[rel];
    if (fromCatalog) return fromCatalog;
  }
  const name = row.manager?.trim();
  if (!name) return null;
  const hit = snap.users.find(
    (u) =>
      (u.role === "manager" || u.role === "regional_manager") &&
      (u.fullName.trim() === name || managerDisplayMatchesCatalogName(row.manager, u.fullName)),
  );
  return hit?.id ?? null;
}

/** Менеджер и РОП команды по строке и org snapshot. */
export function getRowHierarchy(row: DealerRow, snap: OrgSnapshot | null): RowHierarchyMeta {
  if (!snap) {
    return { manager: null, managerUserId: null, rop: null, ropUserId: null };
  }
  const managerUserId = resolveManagerUserIdFromRow(row, snap);
  const manager = managerUserId ? (snap.users.find((u) => u.id === managerUserId) ?? null) : null;
  const rop = managerUserId ? ropUserForManager(snap, managerUserId) : null;
  return {
    manager,
    managerUserId,
    rop,
    ropUserId: rop?.id ?? null,
  };
}
