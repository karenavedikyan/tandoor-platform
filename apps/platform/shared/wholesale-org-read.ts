/**
 * Единый read-only слой организационных данных 1С для существующих экранов ЛК.
 * Источники: wholesale_client_metadata, wholesale_outlet_metadata, wholesale_source_snapshots, exchange_users_raw.
 */

import type { PoolLike } from "./responsibility-resolver.js";
import type {
  WholesaleAccountLinkState,
  WholesaleAssignmentType,
  WholesaleClientAssignment,
  WholesaleEmployeePreviewScope,
  WholesaleEmployeeRecord,
  WholesaleManagerNode,
  WholesaleOrgReadResult,
  WholesaleOrgTotals,
  WholesaleReviewFlag,
  WholesaleRmNode,
  WholesaleRopNode,
} from "./wholesale-org-types.js";

const NULL_GUID = "00000000-0000-0000-0000-000000000000";
const NO_ROP_GUID = "__no_rop__";
const NO_ROP_NAME = "Без РОП";

type ClientMetaRow = {
  guid_client: string;
  external_key: string;
  name: string;
  city: string | null;
  region: string | null;
  holding: boolean | null;
  holding_link_state: string | null;
  pending_holding_guid: string | null;
  manager_roster_state: string | null;
  raw: Record<string, unknown>;
};

type OutletMetaRow = {
  guid_store: string;
  guid_client: string;
  closed: boolean;
};

type RosterRow = {
  guid_manager: string;
  name_manager: string;
  position?: string | null;
};

type LinkedAccountRow = {
  id: string;
  full_name: string | null;
  status: string;
};

function normGuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().toLowerCase();
  if (!t || t === NULL_GUID) return null;
  return t;
}

function normName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values: Iterable<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of Array.from(values)) {
    const t = v.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function parseRawJson(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

export async function loadWholesaleEmployeeRoster(pool: PoolLike): Promise<{
  rows: RosterRow[];
  importedAt: string | null;
  error: string | null;
}> {
  try {
    const snap = await pool.query<{ raw: Record<string, unknown>; imported_at: string | null }>(
      `SELECT raw, imported_at
         FROM wholesale_source_snapshots
        WHERE source_kind IN ('wholesale', '1c-wholesale', 'timeweb-fresh')
        ORDER BY imported_at DESC NULLS LAST
        LIMIT 1`,
    );
    const snapRow = snap.rows[0];
    const rosterRaw = snapRow?.raw?.employeeRoster;
    if (Array.isArray(rosterRaw) && rosterRaw.length > 0) {
      const rows = rosterRaw
        .map((r) => {
          const row = r as Record<string, unknown>;
          const guid = normGuid(row.guid_manager ?? row.guid);
          const name = normName(row.name_manager ?? row.name);
          if (!guid || !name) return null;
          return {
            guid_manager: guid,
            name_manager: name,
            position: normName(row.position ?? row.job_title) || null,
          };
        })
        .filter(Boolean) as RosterRow[];
      if (rows.length > 0) {
        return { rows, importedAt: snapRow?.imported_at ? String(snapRow.imported_at) : null, error: null };
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { rows: [], importedAt: null, error: msg };
  }

  try {
    const ex = await pool.query<{ id_1c: string; name: string }>(
      `SELECT id_1c::text AS id_1c, name FROM exchange_users_raw ORDER BY name`,
    );
    const rows = ex.rows
      .map((r) => {
        const guid = normGuid(r.id_1c);
        const name = normName(r.name);
        if (!guid || !name) return null;
        return { guid_manager: guid, name_manager: name, position: null };
      })
      .filter(Boolean) as RosterRow[];
    return { rows, importedAt: null, error: rows.length === 0 ? "ROSTER_EMPTY" : null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { rows: [], importedAt: null, error: msg };
  }
}

async function loadLinkedAccounts(pool: PoolLike): Promise<Map<string, LinkedAccountRow>> {
  const r = await pool.query<LinkedAccountRow>(
    `SELECT id::text AS id, full_name, status::text AS status FROM users WHERE status IN ('active', 'invited')`,
  );
  const byName = new Map<string, LinkedAccountRow[]>();
  for (const row of r.rows) {
    const key = normName(row.full_name).toLowerCase();
    if (!key) continue;
    const list = byName.get(key) ?? [];
    list.push(row);
    byName.set(key, list);
  }
  // GUID-based links are intentionally NOT inferred from similar names.
  void byName;
  return new Map(r.rows.map((row) => [row.id.toLowerCase(), row]));
}

function resolveAccountLink(
  employeeGuid: string,
  fullName: string,
  linkedById: Map<string, LinkedAccountRow>,
): { state: WholesaleAccountLinkState; userId: string | null } {
  const byGuid = linkedById.get(employeeGuid.toLowerCase());
  if (byGuid) {
    return {
      state: byGuid.status === "active" ? "linked" : "inactive_account",
      userId: byGuid.id,
    };
  }
  return { state: "no_account", userId: null };
}

function buildReviewFlags(input: {
  headOfSalesGuid: string | null;
  responsibleGuid: string | null;
  responsibleInRoster: boolean;
  holdingLinkState: string | null;
  pendingHoldingGuid: string | null;
  managerRosterState: string | null;
  ambiguousRopForManager: boolean;
}): WholesaleReviewFlag[] {
  const flags: WholesaleReviewFlag[] = [];
  if (!input.headOfSalesGuid) flags.push("missing_rop");
  if (!input.responsibleGuid) flags.push("missing_responsible");
  if (input.responsibleGuid && !input.responsibleInRoster) flags.push("responsible_outside_roster");
  if (
    input.holdingLinkState === "unresolved" ||
    input.holdingLinkState === "pending" ||
    (input.pendingHoldingGuid && input.holdingLinkState !== "resolved")
  ) {
    flags.push("unresolved_holding");
  }
  if (input.managerRosterState === "outside_wholesale_roster") flags.push("responsible_outside_roster");
  if (input.ambiguousRopForManager) flags.push("ambiguous_rop_for_manager");
  return uniqueStrings(flags) as WholesaleReviewFlag[];
}

function clientFromRow(
  row: ClientMetaRow,
  outletsByClient: Map<string, OutletMetaRow[]>,
  rosterGuids: Set<string>,
  managerRopMap: Map<string, Set<string>>,
): WholesaleClientAssignment {
  const raw = row.raw;
  const headOfSalesGuid = normGuid(raw.guid_head_of_the_sales_department);
  const headOfSalesName = normName(raw.name_head_of_the_sales_department) || null;
  const responsibleGuid = normGuid(raw.guid_manager);
  const responsibleName = normName(raw.name_manager) || null;
  const regionalGuid = normGuid(raw.guid_regional_manager);
  const regionalName = normName(raw.name_regional_manager) || null;
  const hardwareGuid = normGuid(raw.guid_hardware_manager);
  const hardwareName = normName(raw.name_hardware_manager) || null;

  const outlets = outletsByClient.get(row.guid_client) ?? [];
  const storeGuids = outlets.map((o) => o.guid_store);
  const openStoreGuids = outlets.filter((o) => !o.closed).map((o) => o.guid_store);
  const closedStoreGuids = outlets.filter((o) => o.closed).map((o) => o.guid_store);

  const ambiguousRopForManager =
    Boolean(responsibleGuid) &&
    (managerRopMap.get(responsibleGuid!)?.size ?? 0) > 1;

  const reviewFlags = buildReviewFlags({
    headOfSalesGuid,
    responsibleGuid,
    responsibleInRoster: responsibleGuid ? rosterGuids.has(responsibleGuid) : false,
    holdingLinkState: row.holding_link_state,
    pendingHoldingGuid: normGuid(row.pending_holding_guid),
    managerRosterState: row.manager_roster_state,
    ambiguousRopForManager,
  });

  return {
    guidClient: row.guid_client,
    externalKey: row.external_key,
    name: row.name,
    city: row.city,
    region: row.region,
    holding: Boolean(row.holding),
    holdingLinkState: row.holding_link_state,
    pendingHoldingGuid: normGuid(row.pending_holding_guid),
    managerRosterState: row.manager_roster_state,
    headOfSalesGuid,
    headOfSalesName,
    responsibleManagerGuid: responsibleGuid,
    responsibleManagerName: responsibleName,
    regionalManagerGuid: regionalGuid,
    regionalManagerName: regionalName,
    hardwareManagerGuid: hardwareGuid,
    hardwareManagerName: hardwareName,
    storeGuids,
    openStoreGuids,
    closedStoreGuids,
    reviewFlags,
  };
}

function countUnique<T>(values: Iterable<T>): number {
  return new Set(values).size;
}

export function buildWholesaleHierarchy(
  clients: WholesaleClientAssignment[],
  employees: WholesaleEmployeeRecord[],
  searchQ = "",
): WholesaleRopNode[] {
  const q = searchQ.trim().toLowerCase();
  const employeeByGuid = new Map(employees.map((e) => [e.employeeGuid, e]));

  const ropBuckets = new Map<string, WholesaleRopNode>();
  const ensureRop = (guid: string | null, name: string | null): WholesaleRopNode => {
    const key = guid ?? NO_ROP_GUID;
    let node = ropBuckets.get(key);
    if (!node) {
      const emp = guid ? employeeByGuid.get(guid) : undefined;
      node = {
        employeeGuid: key,
        fullName: name?.trim() || emp?.fullName || (guid ? guid : NO_ROP_NAME),
        position: emp?.position ?? null,
        teamId: key,
        teamName: name?.trim() || emp?.fullName || (guid ? guid : NO_ROP_NAME),
        rmCount: 0,
        managerCount: 0,
        clientCount: 0,
        storeCount: 0,
        ownClientCount: 0,
        rms: [],
        managers: [],
        isSynthetic: !guid,
      };
      ropBuckets.set(key, node);
    }
    return node;
  };

  const rmByRop = new Map<string, Map<string, WholesaleRmNode>>();
  const mgrByRop = new Map<string, Map<string, WholesaleManagerNode>>();

  for (const client of clients) {
    const ropNode = ensureRop(client.headOfSalesGuid, client.headOfSalesName);

    if (
      client.headOfSalesGuid &&
      client.responsibleManagerGuid &&
      client.headOfSalesGuid === client.responsibleManagerGuid
    ) {
      ropNode.ownClientCount += 1;
    }

    if (client.regionalManagerGuid) {
      const rmMap = rmByRop.get(ropNode.employeeGuid) ?? new Map<string, WholesaleRmNode>();
      if (!rmMap.has(client.regionalManagerGuid)) {
        const emp = employeeByGuid.get(client.regionalManagerGuid);
        rmMap.set(client.regionalManagerGuid, {
          employeeGuid: client.regionalManagerGuid,
          fullName: client.regionalManagerName ?? emp?.fullName ?? client.regionalManagerGuid,
          position: emp?.position ?? null,
          assignmentType: "regional_manager",
          clientCount: 0,
          storeCount: 0,
          hasAccount: emp?.accountLinkState === "linked",
        });
      }
      rmByRop.set(ropNode.employeeGuid, rmMap);
    }

    if (client.responsibleManagerGuid) {
      const mgrMap = mgrByRop.get(ropNode.employeeGuid) ?? new Map<string, WholesaleManagerNode>();
      let mgr = mgrMap.get(client.responsibleManagerGuid);
      if (!mgr) {
        const emp = employeeByGuid.get(client.responsibleManagerGuid);
        mgr = {
          employeeGuid: client.responsibleManagerGuid,
          fullName: client.responsibleManagerName ?? emp?.fullName ?? client.responsibleManagerGuid,
          position: emp?.position ?? null,
          assignmentType: "responsible_manager",
          clientCount: 0,
          storeCount: 0,
          hasAccount: emp?.accountLinkState === "linked",
          ambiguousRop: client.reviewFlags.includes("ambiguous_rop_for_manager"),
          reviewReasons: [],
        };
        mgrMap.set(client.responsibleManagerGuid, mgr);
      }
      if (client.reviewFlags.includes("ambiguous_rop_for_manager")) {
        mgr.ambiguousRop = true;
        mgr.reviewReasons = uniqueStrings([...mgr.reviewReasons, "Несколько РОП по назначениям клиентов"]);
      }
      mgrByRop.set(ropNode.employeeGuid, mgrMap);
    }
  }

  // Fix store counts with unique sets
  for (const [ropKey, rmMap] of Array.from(rmByRop.entries())) {
    for (const rm of Array.from(rmMap.values())) {
      const storeSet = new Set<string>();
      const clientSet = new Set<string>();
      for (const c of clients) {
        const ropKeyForClient = c.headOfSalesGuid ?? NO_ROP_GUID;
        if (ropKeyForClient !== ropKey) continue;
        if (c.regionalManagerGuid === rm.employeeGuid) {
          clientSet.add(c.guidClient);
          for (const s of c.storeGuids) storeSet.add(s);
        }
      }
      rm.clientCount = clientSet.size;
      rm.storeCount = storeSet.size;
    }
  }
  for (const [ropKey, mgrMap] of Array.from(mgrByRop.entries())) {
    for (const mgr of Array.from(mgrMap.values())) {
      const storeSet = new Set<string>();
      const clientSet = new Set<string>();
      for (const c of clients) {
        const ropKeyForClient = c.headOfSalesGuid ?? NO_ROP_GUID;
        if (ropKeyForClient !== ropKey) continue;
        if (c.responsibleManagerGuid === mgr.employeeGuid) {
          clientSet.add(c.guidClient);
          for (const s of c.storeGuids) storeSet.add(s);
        }
      }
      mgr.clientCount = clientSet.size;
      mgr.storeCount = storeSet.size;
    }
  }

  const nodes: WholesaleRopNode[] = [];
  for (const [ropKey, node] of Array.from(ropBuckets.entries())) {
    const storeSet = new Set<string>();
    const clientSet = new Set<string>();
    for (const c of clients) {
      const key = c.headOfSalesGuid ?? NO_ROP_GUID;
      if (key !== ropKey) continue;
      clientSet.add(c.guidClient);
      for (const s of c.storeGuids) storeSet.add(s);
    }
    node.clientCount = clientSet.size;
    node.storeCount = storeSet.size;
    node.rms = Array.from(rmByRop.get(ropKey)?.values() ?? []).sort((a, b) =>
      a.fullName.localeCompare(b.fullName, "ru"),
    );
    node.managers = Array.from(mgrByRop.get(ropKey)?.values() ?? []).sort((a, b) =>
      a.fullName.localeCompare(b.fullName, "ru"),
    );
    node.rmCount = node.rms.length;
    node.managerCount = node.managers.length;

    if (!q) {
      nodes.push(node);
      continue;
    }
    const ropHit = node.fullName.toLowerCase().includes(q) || node.employeeGuid.toLowerCase().includes(q);
    const filteredRms = ropHit
      ? node.rms
      : node.rms.filter(
          (rm: WholesaleRmNode) =>
            rm.fullName.toLowerCase().includes(q) || rm.employeeGuid.includes(q),
        );
    const filteredMgrs = ropHit
      ? node.managers
      : node.managers.filter(
          (m: WholesaleManagerNode) =>
            m.fullName.toLowerCase().includes(q) || m.employeeGuid.includes(q),
        );
    if (ropHit || filteredRms.length > 0 || filteredMgrs.length > 0) {
      nodes.push({ ...node, rms: filteredRms, managers: filteredMgrs });
    }
  }

  return nodes.sort((a, b) => {
    if (a.isSynthetic !== b.isSynthetic) return a.isSynthetic ? 1 : -1;
    return a.fullName.localeCompare(b.fullName, "ru");
  });
}

export function computeWholesaleOrgTotals(clients: WholesaleClientAssignment[]): WholesaleOrgTotals {
  const allStores = new Set<string>();
  const openStores = new Set<string>();
  const closedStores = new Set<string>();
  const rops = new Set<string>();
  const managers = new Set<string>();
  const rms = new Set<string>();
  let needsReview = 0;
  let unassigned = 0;

  for (const c of clients) {
    if (c.headOfSalesGuid) rops.add(c.headOfSalesGuid);
    if (c.responsibleManagerGuid) managers.add(c.responsibleManagerGuid);
    if (c.regionalManagerGuid) rms.add(c.regionalManagerGuid);
    for (const s of c.storeGuids) {
      allStores.add(s);
      if (c.closedStoreGuids.includes(s)) closedStores.add(s);
      else openStores.add(s);
    }
    if (c.reviewFlags.length > 0) needsReview += 1;
    if (!c.headOfSalesGuid && !c.responsibleManagerGuid) unassigned += 1;
  }

  return {
    uniqueClients: clients.length,
    uniqueStores: allStores.size,
    openStores: openStores.size,
    closedStores: closedStores.size,
    ropCount: rops.size,
    managerCount: managers.size,
    regionalManagerCount: rms.size,
    needsReviewCount: needsReview,
    unassignedClientCount: unassigned,
  };
}

export async function readWholesaleOrg(pool: PoolLike): Promise<WholesaleOrgReadResult> {
  const rosterLoad = await loadWholesaleEmployeeRoster(pool);
  const rosterGuids = new Set(rosterLoad.rows.map((r) => r.guid_manager));

  const [clientRes, outletRes, linkedAccounts] = await Promise.all([
    pool.query<ClientMetaRow>(
      `SELECT wm.guid_client::text,
              d.external_key,
              d.name,
              d.city,
              d.region,
              d.holding,
              wm.holding_link_state,
              wm.pending_holding_guid::text,
              wm.manager_roster_state,
              wm.raw
         FROM wholesale_client_metadata wm
         INNER JOIN dealers d ON d.id = wm.guid_client
        ORDER BY d.name`,
    ),
    pool.query<OutletMetaRow>(
      `SELECT guid_store::text, guid_client::text, closed FROM wholesale_outlet_metadata`,
    ),
    loadLinkedAccounts(pool),
  ]);

  const outletsByClient = new Map<string, OutletMetaRow[]>();
  for (const o of outletRes.rows) {
    const list = outletsByClient.get(o.guid_client) ?? [];
    list.push(o);
    outletsByClient.set(o.guid_client, list);
  }

  const clientRows = clientRes.rows.map((row) => ({
    ...row,
    raw: parseRawJson(row.raw),
    external_key: row.external_key,
  }));

  const managerRopMap = new Map<string, Set<string>>();
  for (const row of clientRows) {
    const raw = row.raw;
    const mgr = normGuid(raw.guid_manager);
    const rop = normGuid(raw.guid_head_of_the_sales_department) ?? NO_ROP_GUID;
    if (!mgr) continue;
    const set = managerRopMap.get(mgr) ?? new Set<string>();
    set.add(rop);
    managerRopMap.set(mgr, set);
  }

  const clients = clientRows.map((row) =>
    clientFromRow(row, outletsByClient, rosterGuids, managerRopMap),
  );

  const employeeMap = new Map<string, WholesaleEmployeeRecord>();
  for (const r of rosterLoad.rows) {
    const link = resolveAccountLink(r.guid_manager, r.name_manager, linkedAccounts);
    employeeMap.set(r.guid_manager, {
      employeeGuid: r.guid_manager,
      fullName: r.name_manager,
      position: r.position ?? null,
      source: "employee_roster",
      inRoster: true,
      accountLinkState: link.state,
      accountUserId: link.userId,
    });
  }

  // Assignment-derived employees not in roster (still visible to admin with review flag context)
  for (const c of clients) {
    for (const [guid, name] of [
      [c.headOfSalesGuid, c.headOfSalesName],
      [c.responsibleManagerGuid, c.responsibleManagerName],
      [c.regionalManagerGuid, c.regionalManagerName],
      [c.hardwareManagerGuid, c.hardwareManagerName],
    ] as const) {
      if (!guid || employeeMap.has(guid)) continue;
      const link = resolveAccountLink(guid, name ?? guid, linkedAccounts);
      employeeMap.set(guid, {
        employeeGuid: guid,
        fullName: name ?? guid,
        position: null,
        source: "assignment_derived",
        inRoster: false,
        accountLinkState: link.state,
        accountUserId: link.userId,
      });
    }
  }

  const employees = Array.from(employeeMap.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName, "ru"),
  );
  const hierarchy = buildWholesaleHierarchy(clients, employees);
  const needsReviewClients = clients.filter((c) => c.reviewFlags.length > 0);

  return {
    source: "wholesale_metadata",
    rosterAvailable: rosterLoad.rows.length > 0,
    rosterError: rosterLoad.error,
    importedAt: rosterLoad.importedAt,
    employees,
    clients,
    hierarchy,
    needsReviewClients,
    totals: computeWholesaleOrgTotals(clients),
  };
}

export function wholesaleHierarchyToOneCRopNodes(hierarchy: WholesaleRopNode[]) {
  return hierarchy.map((rop) => ({
    userId: rop.employeeGuid,
    fullName: rop.fullName,
    phone: null as string | null,
    email: null as string | null,
    teamId: rop.teamId,
    teamName: rop.teamName,
    rmCount: rop.rmCount,
    managerCount: rop.managerCount,
    storeCount: rop.storeCount,
    legalCount: rop.clientCount,
    rms: rop.rms.map((rm) => ({
      userId: rm.employeeGuid,
      fullName: rm.fullName,
      phone: null as string | null,
      storeCount: rm.storeCount,
      legalCount: rm.clientCount,
      hasMatch: true,
      managers: [] as [],
    })),
    managers: rop.managers.map((mgr) => ({
      userId: mgr.employeeGuid,
      fullName: mgr.fullName,
      phone: null as string | null,
      storeCount: mgr.storeCount,
      legalCount: mgr.clientCount,
      hasMatch: true,
    })),
  }));
}

export function resolveWholesaleEmployeePreviewScope(
  org: WholesaleOrgReadResult,
  employeeGuid: string,
  assignmentType: WholesaleAssignmentType,
): WholesaleEmployeePreviewScope {
  const guid = normGuid(employeeGuid);
  if (!guid) {
    return {
      employeeGuid: employeeGuid,
      fullName: "",
      assignmentType,
      confirmed: false,
      reason: "INVALID_EMPLOYEE_GUID",
      activeDealerExternalKeys: [],
      activeStoreGuids: [],
    };
  }

  const employee = org.employees.find((e) => e.employeeGuid === guid);
  if (!employee) {
    return {
      employeeGuid: guid,
      fullName: "",
      assignmentType,
      confirmed: false,
      reason: "EMPLOYEE_NOT_IN_ROSTER",
      activeDealerExternalKeys: [],
      activeStoreGuids: [],
    };
  }

  const keys = new Set<string>();
  const stores = new Set<string>();
  let reason: string | null = null;
  let confirmed = true;

  for (const c of org.clients) {
    let match = false;
    switch (assignmentType) {
      case "head_of_sales":
        match = c.headOfSalesGuid === guid;
        break;
      case "responsible_manager":
        match = c.responsibleManagerGuid === guid;
        break;
      case "regional_manager":
        match = c.regionalManagerGuid === guid;
        break;
      case "hardware_manager":
        match = c.hardwareManagerGuid === guid;
        break;
      case "store_manager":
        match = false;
        break;
      default:
        match = false;
    }
    if (!match) continue;
    keys.add(c.externalKey);
    for (const s of c.openStoreGuids) stores.add(s);
  }

  if (keys.size === 0) {
    confirmed = false;
    reason = "NO_ASSIGNMENTS_FOR_TYPE";
  }
  if (!employee.inRoster) {
    confirmed = false;
    reason = reason ?? "OUTSIDE_ROSTER";
  }

  return {
    employeeGuid: guid,
    fullName: employee.fullName,
    assignmentType,
    confirmed,
    reason,
    activeDealerExternalKeys: Array.from(keys).sort(),
    activeStoreGuids: Array.from(stores).sort(),
  };
}

export async function hasWholesaleOrgData(pool: PoolLike): Promise<boolean> {
  try {
    const r = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM wholesale_client_metadata LIMIT 1`,
    );
    return Number(r.rows[0]?.n ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function hasLkTeams(pool: PoolLike): Promise<boolean> {
  try {
    const r = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM teams WHERE rop_user_id IS NOT NULL`,
    );
    return Number(r.rows[0]?.n ?? 0) > 0;
  } catch {
    return false;
  }
}
