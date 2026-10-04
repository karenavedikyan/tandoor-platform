/**
 * Адаптер wholesale org → OrgScopePayload для существующих экранов ЛК.
 */

import type { OrgScopePayload, TeamScopeMember } from "./dealers-scope-types.js";
import { finalizeKpiScopeTotals } from "./kpi-scope-totals.js";
import { readWholesaleOrg } from "./wholesale-org-read.js";
import type { PoolLike } from "./responsibility-resolver.js";
import type { WholesaleEmployeePreviewScope } from "./wholesale-org-types.js";

function memberFromWholesale(input: {
  id: string;
  name: string;
  role: "manager" | "regional_manager" | "rop";
  externalKeys: string[];
  storeIds: string[];
}): TeamScopeMember {
  return {
    user: {
      id: input.id,
      name: input.name,
      email: "",
      role: input.role,
    },
    totals: {
      active_dealers: input.externalKeys.length,
      active_trade_points: input.storeIds.length,
      trashed_dealers: 0,
      trashed_trade_points: 0,
      ...finalizeKpiScopeTotals({
        tp_status_active: 0,
        tp_status_potential: 0,
        tp_status_attention: 0,
        dealer_no_status: 0,
        avg_distribution: 0,
        _distribution_sum: 0,
        _distribution_weight: 0,
      }),
    },
    active_dealer_ids: [],
    active_dealer_external_keys: input.externalKeys,
    trashed_dealer_external_keys: [],
    active_trade_points: input.storeIds.map((tp_id) => ({
      tp_id,
      dealer_id: "",
      is_primary: false,
    })),
  };
}

function unionMemberKeys(members: TeamScopeMember[]): { keys: Set<string>; stores: Set<string> } {
  const keys = new Set<string>();
  const stores = new Set<string>();
  for (const m of members) {
    for (const k of m.active_dealer_external_keys) keys.add(k);
    for (const tp of m.active_trade_points) stores.add(tp.tp_id);
  }
  return { keys, stores };
}

function totalsFromUnion(keys: Set<string>, stores: Set<string>) {
  return {
    active_dealers: keys.size,
    active_trade_points: stores.size,
    trashed_dealers: 0,
    trashed_trade_points: 0,
    tp_status_active: 0,
    tp_status_potential: 0,
    tp_status_attention: 0,
    dealer_no_status: 0,
    avg_distribution: 0,
  };
}

const NO_ROP_GUID = "__no_rop__";

export async function fetchWholesaleOrgScope(
  pool: PoolLike,
  previewScope?: WholesaleEmployeePreviewScope | null,
): Promise<OrgScopePayload> {
  const org = await readWholesaleOrg(pool);
  const allowedKeys =
    previewScope && previewScope.activeDealerExternalKeys.length > 0
      ? new Set(previewScope.activeDealerExternalKeys)
      : null;
  const allowedStores =
    previewScope && previewScope.activeStoreGuids.length > 0
      ? new Set(previewScope.activeStoreGuids)
      : null;

  const filterKeys = (keys: string[]) =>
    allowedKeys ? keys.filter((k) => allowedKeys.has(k)) : keys;
  const filterStores = (ids: string[]) =>
    allowedStores ? ids.filter((id) => allowedStores.has(id)) : ids;

  const teams: OrgScopePayload["teams"] = org.hierarchy
    .map((rop) => {
      const ropKey = rop.employeeGuid;

      const members: TeamScopeMember[] = [
        ...rop.managers.map((mgr) => {
          const keys = filterKeys(
            org.clients
              .filter(
                (c) =>
                  (c.headOfSalesGuid ?? NO_ROP_GUID) === ropKey &&
                  c.responsibleManagerGuid === mgr.employeeGuid,
              )
              .map((c) => c.externalKey),
          );
          const stores = filterStores(
            org.clients
              .filter(
                (c) =>
                  (c.headOfSalesGuid ?? NO_ROP_GUID) === ropKey &&
                  c.responsibleManagerGuid === mgr.employeeGuid,
              )
              .flatMap((c) => c.openStoreGuids),
          );
          return memberFromWholesale({
            id: mgr.employeeGuid,
            name: mgr.fullName,
            role: "manager",
            externalKeys: keys,
            storeIds: stores,
          });
        }),
        ...rop.rms.map((rm) => {
          const keys = filterKeys(
            org.clients
              .filter(
                (c) =>
                  (c.headOfSalesGuid ?? NO_ROP_GUID) === ropKey &&
                  c.regionalManagerGuid === rm.employeeGuid,
              )
              .map((c) => c.externalKey),
          );
          const stores = filterStores(
            org.clients
              .filter(
                (c) =>
                  (c.headOfSalesGuid ?? NO_ROP_GUID) === ropKey &&
                  c.regionalManagerGuid === rm.employeeGuid,
              )
              .flatMap((c) => c.openStoreGuids),
          );
          return memberFromWholesale({
            id: rm.employeeGuid,
            name: rm.fullName,
            role: "regional_manager",
            externalKeys: keys,
            storeIds: stores,
          });
        }),
      ].filter((m) => m.active_dealer_external_keys.length > 0 || m.active_trade_points.length > 0);

      if (members.length === 0 && previewScope) return null;

      const union = unionMemberKeys(members);
      const teamTotals = totalsFromUnion(union.keys, union.stores);

      return {
        team: {
          id: rop.teamId,
          name: rop.teamName,
          rop: rop.isSynthetic
            ? null
            : { id: rop.employeeGuid, name: rop.fullName, email: "" },
        },
        members,
        team_totals: {
          ...teamTotals,
          ...finalizeKpiScopeTotals({
            tp_status_active: 0,
            tp_status_potential: 0,
            tp_status_attention: 0,
            dealer_no_status: 0,
            avg_distribution: 0,
            _distribution_sum: 0,
            _distribution_weight: 0,
          }),
        },
      };
    })
    .filter(Boolean) as OrgScopePayload["teams"];

  const unassignedKeys = filterKeys(
    org.clients
      .filter((c) => !c.headOfSalesGuid && !c.responsibleManagerGuid)
      .map((c) => c.externalKey),
  );

  const orphanMembers: TeamScopeMember[] =
    unassignedKeys.length > 0
      ? [
          memberFromWholesale({
            id: "__orphan_wholesale__",
            name: "Без закрепления",
            role: "manager",
            externalKeys: unassignedKeys,
            storeIds: filterStores(
              org.clients
                .filter((c) => !c.headOfSalesGuid && !c.responsibleManagerGuid)
                .flatMap((c) => c.openStoreGuids),
            ),
          }),
        ]
      : [];

  const needsReviewKeys = filterKeys(org.needsReviewClients.map((c) => c.externalKey));
  if (needsReviewKeys.length > 0) {
    orphanMembers.push(
      memberFromWholesale({
        id: "__needs_review__",
        name: "Требуют проверки",
        role: "manager",
        externalKeys: needsReviewKeys,
        storeIds: filterStores(org.needsReviewClients.flatMap((c) => c.openStoreGuids)),
      }),
    );
  }

  const orphanUnion = unionMemberKeys(orphanMembers);

  const org_totals = {
    active_dealers: previewScope
      ? previewScope.activeDealerExternalKeys.length
      : org.totals.uniqueClients,
    active_trade_points: previewScope
      ? previewScope.activeStoreGuids.length
      : org.totals.openStores,
    trashed_dealers: 0,
    trashed_trade_points: 0,
    ...finalizeKpiScopeTotals({
      tp_status_active: 0,
      tp_status_potential: 0,
      tp_status_attention: 0,
      dealer_no_status: 0,
      avg_distribution: 0,
      _distribution_sum: 0,
      _distribution_weight: 0,
    }),
  };

  return {
    success: true,
    org: { id: "wholesale-org", name: "ОПТ · данные 1С" },
    teams,
    orphan: {
      label: "Без команды / проверка",
      members: orphanMembers,
      totals: {
        ...totalsFromUnion(orphanUnion.keys, orphanUnion.stores),
        ...finalizeKpiScopeTotals({
          tp_status_active: 0,
          tp_status_potential: 0,
          tp_status_attention: 0,
          dealer_no_status: 0,
          avg_distribution: 0,
          _distribution_sum: 0,
          _distribution_weight: 0,
        }),
      },
    },
    org_totals,
  };
}
