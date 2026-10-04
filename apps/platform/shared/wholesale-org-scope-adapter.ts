/**
 * Адаптер wholesale org → OrgScopePayload для существующих экранов ЛК.
 */

import type { OrgScopePayload, TeamScopeMember } from "./dealers-scope-types.js";
import { finalizeKpiScopeTotals } from "./kpi-scope-totals.js";
import { readWholesaleOrg } from "./wholesale-org-read.js";
import type { PoolLike } from "./responsibility-resolver.js";

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

export async function fetchWholesaleOrgScope(pool: PoolLike): Promise<OrgScopePayload> {
  const org = await readWholesaleOrg(pool);

  const teams: OrgScopePayload["teams"] = org.hierarchy.map((rop) => {
    const ropClientKeys = org.clients
      .filter((c) => (c.headOfSalesGuid ?? "__no_rop__") === rop.employeeGuid)
      .map((c) => c.externalKey);
    const ropStoreIds = org.clients
      .filter((c) => (c.headOfSalesGuid ?? "__no_rop__") === rop.employeeGuid)
      .flatMap((c) => c.openStoreGuids);

    const members: TeamScopeMember[] = [
      ...rop.managers.map((mgr) => {
        const keys = org.clients
          .filter(
            (c) =>
              (c.headOfSalesGuid ?? "__no_rop__") === rop.employeeGuid &&
              c.responsibleManagerGuid === mgr.employeeGuid,
          )
          .map((c) => c.externalKey);
        const stores = org.clients
          .filter(
            (c) =>
              (c.headOfSalesGuid ?? "__no_rop__") === rop.employeeGuid &&
              c.responsibleManagerGuid === mgr.employeeGuid,
          )
          .flatMap((c) => c.openStoreGuids);
        return memberFromWholesale({
          id: mgr.employeeGuid,
          name: mgr.fullName,
          role: "manager",
          externalKeys: keys,
          storeIds: stores,
        });
      }),
      ...rop.rms.map((rm) => {
        const keys = org.clients
          .filter(
            (c) =>
              (c.headOfSalesGuid ?? "__no_rop__") === rop.employeeGuid &&
              c.regionalManagerGuid === rm.employeeGuid,
          )
          .map((c) => c.externalKey);
        const stores = org.clients
          .filter(
            (c) =>
              (c.headOfSalesGuid ?? "__no_rop__") === rop.employeeGuid &&
              c.regionalManagerGuid === rm.employeeGuid,
          )
          .flatMap((c) => c.openStoreGuids);
        return memberFromWholesale({
          id: rm.employeeGuid,
          name: rm.fullName,
          role: "regional_manager",
          externalKeys: keys,
          storeIds: stores,
        });
      }),
    ];

    const teamTotals = members.reduce(
      (acc, m) => ({
        active_dealers: acc.active_dealers + m.totals.active_dealers,
        active_trade_points: acc.active_trade_points + m.totals.active_trade_points,
        trashed_dealers: 0,
        trashed_trade_points: 0,
        tp_status_active: 0,
        tp_status_potential: 0,
        tp_status_attention: 0,
        dealer_no_status: 0,
        avg_distribution: 0,
      }),
      {
        active_dealers: 0,
        active_trade_points: 0,
        trashed_dealers: 0,
        trashed_trade_points: 0,
        tp_status_active: 0,
        tp_status_potential: 0,
        tp_status_attention: 0,
        dealer_no_status: 0,
        avg_distribution: 0,
      },
    );

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
  });

  const unassignedKeys = org.clients
    .filter((c) => !c.headOfSalesGuid && !c.responsibleManagerGuid)
    .map((c) => c.externalKey);

  const orphanMembers: TeamScopeMember[] =
    unassignedKeys.length > 0
      ? [
          memberFromWholesale({
            id: "__orphan_wholesale__",
            name: "Без закрепления",
            role: "manager",
            externalKeys: unassignedKeys,
            storeIds: org.clients
              .filter((c) => !c.headOfSalesGuid && !c.responsibleManagerGuid)
              .flatMap((c) => c.openStoreGuids),
          }),
        ]
      : [];

  const needsReviewKeys = org.needsReviewClients.map((c) => c.externalKey);
  if (needsReviewKeys.length > 0) {
    orphanMembers.push(
      memberFromWholesale({
        id: "__needs_review__",
        name: "Требуют проверки",
        role: "manager",
        externalKeys: needsReviewKeys,
        storeIds: org.needsReviewClients.flatMap((c) => c.openStoreGuids),
      }),
    );
  }

  const orphanTotals = orphanMembers.reduce(
    (acc, m) => ({
      active_dealers: acc.active_dealers + m.totals.active_dealers,
      active_trade_points: acc.active_trade_points + m.totals.active_trade_points,
      trashed_dealers: 0,
      trashed_trade_points: 0,
      tp_status_active: 0,
      tp_status_potential: 0,
      tp_status_attention: 0,
      dealer_no_status: 0,
      avg_distribution: 0,
    }),
    {
      active_dealers: 0,
      active_trade_points: 0,
      trashed_dealers: 0,
      trashed_trade_points: 0,
      tp_status_active: 0,
      tp_status_potential: 0,
      tp_status_attention: 0,
      dealer_no_status: 0,
      avg_distribution: 0,
    },
  );

  const org_totals = {
    active_dealers: org.totals.uniqueClients,
    active_trade_points: org.totals.openStores,
    trashed_dealers: 0,
    trashed_trade_points: org.totals.closedStores,
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
        ...orphanTotals,
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
