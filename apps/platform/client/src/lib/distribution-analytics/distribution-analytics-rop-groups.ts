import { mergeTradePointsForActualization } from "../client-base-actualization-data-merge.js";
import type { ActualizationState } from "../client-base-actualization-state.js";
import {
  isRopUserInSnapshot,
  managersForRopTeam,
  realRowsForManagerByUUID,
  realRowsForRopTeam,
} from "../dealer-base-real-scope.js";
import type { DealerRow } from "../dealer-base-mock-data.js";
import type { OrgSnapshot } from "../use-org-snapshot.js";

export const UNASSIGNED_ROP_ID = "__unassigned__";

export type RopManagerDistributionGroup = {
  managerId: string;
  managerName: string;
  tradePointIds: string[];
};

export type RopDistributionGroup = {
  ropId: string;
  ropName: string;
  tradePointIds: string[];
  managers: RopManagerDistributionGroup[];
  isUnassigned: boolean;
};

/** Собрать id активных ТТ по строкам дилеров (тот же путь, что KPI и #899). */
export function collectTradePointIdsForDealers(
  rows: readonly DealerRow[],
  act: ActualizationState,
): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    for (const e of mergeTradePointsForActualization(row, act)) {
      if (!e.isArchived) ids.push(e.point.id);
    }
  }
  return ids;
}

function buildManagerGroups(
  scopedDealers: readonly DealerRow[],
  snap: OrgSnapshot,
  ropUserId: string,
  ropDealerRows: readonly DealerRow[],
  act: ActualizationState,
): RopManagerDistributionGroup[] {
  const ropDealerIds = new Set(ropDealerRows.map((r) => r.id));
  const managers = managersForRopTeam(snap, ropUserId);
  const groups: RopManagerDistributionGroup[] = [];

  for (const manager of managers) {
    const managerRows = realRowsForManagerByUUID([...scopedDealers], snap, manager.id).filter((r) =>
      ropDealerIds.has(r.id),
    );
    const tradePointIds = collectTradePointIdsForDealers(managerRows, act);
    if (tradePointIds.length === 0) continue;
    groups.push({
      managerId: manager.id,
      managerName: manager.fullName.trim() || manager.id,
      tradePointIds,
    });
  }

  return groups.sort(
    (a, b) =>
      b.tradePointIds.length - a.tradePointIds.length ||
      a.managerName.localeCompare(b.managerName, "ru"),
  );
}

/** Группы дистрибуции по реальным РОПам из org-snapshot (rop_id), остаток — «Без РОПа». */
export function buildRopGroups(
  scopedDealers: readonly DealerRow[],
  snap: OrgSnapshot | null | undefined,
  act: ActualizationState,
): RopDistributionGroup[] {
  if (!snap) return [];

  const realRops = snap.users.filter((u) => u.role === "rop" && isRopUserInSnapshot(snap, u.id));
  const assignedDealerIds = new Set<string>();
  const groups: RopDistributionGroup[] = [];

  for (const rop of realRops) {
    const ropRows = realRowsForRopTeam([...scopedDealers], snap, rop.id);
    for (const r of ropRows) assignedDealerIds.add(r.id);

    const tradePointIds = collectTradePointIdsForDealers(ropRows, act);
    if (tradePointIds.length === 0) continue;

    groups.push({
      ropId: rop.id,
      ropName: rop.fullName.trim() || rop.id,
      tradePointIds,
      managers: buildManagerGroups(scopedDealers, snap, rop.id, ropRows, act),
      isUnassigned: false,
    });
  }

  const unassignedRows = scopedDealers.filter((r) => !assignedDealerIds.has(r.id));
  const unassignedTradePointIds = collectTradePointIdsForDealers(unassignedRows, act);
  if (unassignedTradePointIds.length > 0) {
    groups.push({
      ropId: UNASSIGNED_ROP_ID,
      ropName: "Без РОПа",
      tradePointIds: unassignedTradePointIds,
      managers: [],
      isUnassigned: true,
    });
  }

  const assigned = groups.filter((g) => !g.isUnassigned);
  const unassigned = groups.filter((g) => g.isUnassigned);
  assigned.sort(
    (a, b) =>
      b.tradePointIds.length - a.tradePointIds.length || a.ropName.localeCompare(b.ropName, "ru"),
  );
  return [...assigned, ...unassigned];
}
