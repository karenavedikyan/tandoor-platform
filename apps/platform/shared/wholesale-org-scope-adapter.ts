/**
 * Адаптер wholesale org → OrgScopePayload для существующих экранов ЛК.
 */

import type { OrgScopePayload, TeamScopeMember } from "./dealers-scope-types.js";
import { finalizeKpiScopeTotals } from "./kpi-scope-totals.js";
import { readWholesaleOrg } from "./wholesale-org-read.js";
import type { PoolLike } from "./responsibility-resolver.js";
import type { EmployeePreviewReadScope } from "./employee-preview-read-scope.js";

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

function emptyOrgScope(): OrgScopePayload {
  const emptyTotals = {
    active_dealers: 0,
    active_trade_points: 0,
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
    teams: [],
    orphan: { label: "Без команды / проверка", members: [], totals: emptyTotals },
    org_totals: emptyTotals,
  };
}

function resolvePreviewFilters(previewRead: EmployeePreviewReadScope | null | undefined): {
  restrict: boolean;
  allowedKeys: Set<string>;
  allowedStores: Set<string>;
} | null {
  if (!previewRead || previewRead.mode === "off") return null;
  if (previewRead.mode === "active" && !previewRead.readable) {
    return { restrict: true, allowedKeys: new Set(), allowedStores: new Set() };
  }
  if (previewRead.mode === "active" && previewRead.readable && previewRead.scope) {
    return {
      restrict: true,
      allowedKeys: new Set(previewRead.scope.activeDealerExternalKeys),
      allowedStores: new Set(previewRead.scope.activeStoreGuids),
    };
  }
  return { restrict: true, allowedKeys: new Set(), allowedStores: new Set() };
}

export async function fetchWholesaleOrgScope(
  pool: PoolLike,
  previewRead?: EmployeePreviewReadScope | null,
): Promise<OrgScopePayload> {
  const previewFilters = resolvePreviewFilters(previewRead);
  if (previewFilters?.restrict && previewFilters.allowedKeys.size === 0 && previewFilters.allowedStores.size === 0 && previewRead?.mode === "active") {
    return emptyOrgScope();
  }

  const org = await readWholesaleOrg(pool);
  const allowedKeys = previewFilters?.restrict ? previewFilters.allowedKeys : null;
  const allowedStores = previewFilters?.restrict ? previewFilters.allowedStores : null;

  const filterKeys = (keys: string[]) => (allowedKeys ? keys.filter((k) => allowedKeys.has(k)) : keys);
  const filterStoresForClient = (clientKeys: string[], storeIds: string[]) => {
    if (!allowedStores) return storeIds;
    return storeIds.filter((id) => allowedStores.has(id));
  };

  const teams: OrgScopePayload["teams"] = org.hierarchy
    .map((rop) => {
      const ropKey = rop.employeeGuid;
      const ropClients = org.clients.filter(
        (c) => (c.headOfSalesGuid ?? NO_ROP_GUID) === ropKey,
      );

      const members: TeamScopeMember[] = [
        ...rop.managers.map((mgr) => {
          const matched = ropClients.filter((c) => c.responsibleManagerGuid === mgr.employeeGuid);
          const keys = filterKeys(matched.map((c) => c.externalKey));
          const stores = filterStoresForClient(
            keys,
            matched.flatMap((c) => c.openStoreGuids),
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
          const matched = ropClients.filter((c) => c.regionalManagerGuid === rm.employeeGuid);
          const keys = filterKeys(matched.map((c) => c.externalKey));
          const stores = filterStoresForClient(
            keys,
            matched.flatMap((c) => c.openStoreGuids),
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

      const ropOnlyClients = ropClients.filter(
        (c) => !c.responsibleManagerGuid && !c.regionalManagerGuid,
      );
      const ropOnlyKeys = filterKeys(ropOnlyClients.map((c) => c.externalKey));
      const ropOnlyStores = filterStoresForClient(
        ropOnlyKeys,
        ropOnlyClients.flatMap((c) => c.openStoreGuids),
      );

      const union = unionMemberKeys(members);
      for (const k of ropOnlyKeys) union.keys.add(k);
      for (const s of ropOnlyStores) union.stores.add(s);

      if (members.length === 0 && ropOnlyKeys.length === 0 && previewFilters?.restrict) return null;

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
            storeIds: filterStoresForClient(
              unassignedKeys,
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
        storeIds: filterStoresForClient(
          needsReviewKeys,
          org.needsReviewClients.flatMap((c) => c.openStoreGuids),
        ),
      }),
    );
  }

  const orphanUnion = unionMemberKeys(orphanMembers);

  const orgUnionKeys = new Set<string>();
  const orgUnionStores = new Set<string>();
  for (const t of teams) {
    for (const m of t.members) {
      for (const k of m.active_dealer_external_keys) orgUnionKeys.add(k);
      for (const tp of m.active_trade_points) orgUnionStores.add(tp.tp_id);
    }
  }
  let orgDealers = org.totals.uniqueClients;
  let orgStores = org.totals.openStores;
  if (previewFilters?.restrict) {
    orgDealers = previewFilters.allowedKeys.size;
    orgStores = previewFilters.allowedStores.size;
  } else {
    for (const t of teams) {
      for (const m of t.members) {
        for (const k of m.active_dealer_external_keys) orgUnionKeys.add(k);
        for (const tp of m.active_trade_points) orgUnionStores.add(tp.tp_id);
      }
    }
    for (const m of orphanMembers) {
      for (const k of m.active_dealer_external_keys) orgUnionKeys.add(k);
      for (const tp of m.active_trade_points) orgUnionStores.add(tp.tp_id);
    }
    orgDealers = orgUnionKeys.size;
    orgStores = orgUnionStores.size;
  }

  const org_totals = {
    active_dealers: orgDealers,
    active_trade_points: orgStores,
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
