/**
 * Ядро GET /api/admin/scope-debug — без admin-auth (тестируемо без Neon).
 */

import type { UserRole } from "./auth.js";
import type { PoolLike } from "./responsibility-resolver.js";
import {
  fetchMyOrgSnapshotInternal,
  fetchMyVisibleCodesInternal,
  type VisibleClientsPayload,
} from "./auth-bootstrap-handlers.js";
import { fetchMyClientCodes } from "./my-client-codes-handlers.js";
import type { DealerRow } from "../client/src/lib/dealer-base-mock-data.js";
import type { OrgSnapshot } from "../client/src/lib/use-org-snapshot.js";
import {
  assignmentsScopeFromCodes,
  computeSidebarScopeCountersFromRealScope,
  profileForScopeCounters,
  buildRealScopeForSidebarCounters,
  visiblePayloadFromCodes,
} from "../client/src/lib/sidebar-scope-counter-math.js";
import { assignmentsScopeIsActive } from "../client/src/lib/dealer-base-real-scope.js";
import {
  createEmptyActualizationState,
  type TrashedDealerInfo,
  type TrashedTradePointInfo,
} from "../client/src/lib/client-base-actualization-state.js";

export type ScopeDebugUserRow = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  status: string;
  must_change_password: boolean;
  last_login_at: string | null;
  created_at: string;
};

export type ScopeDebugTeamRow = {
  id: string;
  name: string;
  rop_user_id: string | null;
  role_in_team: string | null;
};

export type ScopeDebugPayload = {
  success: true;
  user: { id: string; email: string; full_name: string; role: UserRole };
  teams: ScopeDebugTeamRow[];
  scope: {
    own_client_codes: string[];
    team_client_codes: string[];
    granted_client_codes: string[];
    visible_dealer_count: number;
    visible_trade_point_count: number;
    trashed_in_scope_count: number;
    catalog_dealer_count: number;
    visible_codes_count: number | null;
    assignments_active: boolean;
  };
  explanation: string[];
};

function orgSnapshotFromInternal(
  payload: Awaited<ReturnType<typeof fetchMyOrgSnapshotInternal>>,
): OrgSnapshot {
  const { success: _s, ...rest } = payload;
  void _s;
  return rest as OrgSnapshot;
}

async function loadTrashedForScope(pool: PoolLike): Promise<{
  dealers: Record<string, TrashedDealerInfo>;
  tradePoints: Record<string, TrashedTradePointInfo>;
}> {
  const dealers: Record<string, TrashedDealerInfo> = {};
  const tradePoints: Record<string, TrashedTradePointInfo> = {};
  const now = new Date().toISOString();
  const dealerRows = await pool.query<{ dealer_id: string; trashed_at: string | null }>(
    `SELECT dealer_id, trashed_at FROM dealer_overrides WHERE trashed_at IS NOT NULL`,
  );
  for (const row of dealerRows.rows) {
    if (!row.dealer_id) continue;
    dealers[row.dealer_id] = {
      dealerId: row.dealer_id,
      trashedAt: row.trashed_at ?? now,
      trashedBy: "",
      trashedByName: "",
      expiresAt: now,
      source: "manual_actualization",
      snapshot: { fullName: null, city: null, inn: null, dealerCode: null, legalEntityName: null },
    };
  }
  const tpRows = await pool.query<{ tp_id: string; dealer_id: string | null; trashed_at: string | null }>(
    `SELECT tp_id, dealer_id, trashed_at FROM trade_point_overrides WHERE trashed_at IS NOT NULL`,
  );
  for (const row of tpRows.rows) {
    if (!row.tp_id) continue;
    tradePoints[row.tp_id] = {
      tradePointId: row.tp_id,
      dealerId: row.dealer_id,
      trashedAt: row.trashed_at ?? now,
      trashedBy: "",
      trashedByName: "",
      expiresAt: now,
      source: "manual_actualization",
      snapshot: { tradePointName: null, city: null, address: null, dealerName: null },
    };
  }
  return { dealers, tradePoints };
}

export async function loadUserTeams(pool: PoolLike, userId: string): Promise<ScopeDebugTeamRow[]> {
  const r = await pool.query<{
    id: string;
    name: string;
    rop_user_id: string | null;
    role_in_team: string | null;
  }>(
    `SELECT t.id, t.name, t.rop_user_id, m.role AS role_in_team
     FROM user_team_memberships m
     INNER JOIN teams t ON t.id = m.team_id
     WHERE m.user_id = $1::uuid
     ORDER BY t.name`,
    [userId],
  );
  return r.rows;
}

function buildExplanation(
  role: UserRole,
  vis: VisibleClientsPayload,
  codes: { own: string[]; team: string[]; granted: string[] },
  counts: { dealers: number; tps: number; trash: number; catalog: number },
): string[] {
  const lines: string[] = [];
  if (
    role === "director" ||
    role === "admin" ||
    role === "analyst" ||
    role === "marketer" ||
    role === "category_manager"
  ) {
    lines.push("director/admin scope: my-visible-codes.all=true → весь каталог API");
    lines.push(`catalog=${counts.catalog} dealers → roleScopedDealerRowsForReal (sales_director) без сужения`);
  } else if (role === "rop") {
    lines.push("rop scope = client_assignments (own responsible) ∪ team (teams.rop_user_id=me) ∪ rop_client_grants");
    lines.push(
      `own=${codes.own.length} codes, team=${codes.team.length} codes, granted=${codes.granted.length} codes`,
    );
    lines.push("visible catalog = API dealers ∩ my-visible-codes; затем roleScopedDealerRowsForReal(team_lead) + assignmentsScope");
  } else if (role === "manager") {
    lines.push("manager scope = client_assignments WHERE responsible_user_id = me");
    lines.push(`own=${codes.own.length} codes → assignmentsScope.ownCodes`);
    lines.push("visible catalog ∩ assignmentsScope → roleScopedDealerRowsForReal(sales_manager)");
  } else if (role === "regional_manager") {
    lines.push("regional_manager scope = dealer_overrides.regional_manager_id = me (client codes)");
    lines.push(`own=${codes.own.length} codes из dealer_overrides, без team scope`);
    lines.push("roleScopedDealerRowsForReal фильтрует releaseCode ∈ ownCodes");
  } else {
    lines.push(`role=${role}: см. my-visible-codes и client_assignments`);
  }
  if (vis.all) {
    lines.push(`visible_codes: all (${counts.catalog} в каталоге)`);
  } else {
    lines.push(`visible_codes: ${vis.codes?.length ?? 0} client codes после my-visible-codes`);
  }
  lines.push(`sidebar dealers=${counts.dealers}, trade_points=${counts.tps}, trash=${counts.trash}`);
  lines.push("trade_points: buildTradePointListForActualization(includeArchivedTradePoints=false) по scoped dealers");
  lines.push("trash: dealer_overrides/trade_point_overrides trashed_at + buildTrashScopeFilter (симметрия dealer scope)");
  return lines;
}

export async function buildScopeDebugPayload(
  pool: PoolLike,
  target: ScopeDebugUserRow,
  catalogOverride?: DealerRow[],
): Promise<ScopeDebugPayload> {
  const role = target.role as UserRole;
  const [orgInternal, visInternal, clientCodes, trashedDb, catalogFromDb] = await Promise.all([
    fetchMyOrgSnapshotInternal(pool, target as Parameters<typeof fetchMyOrgSnapshotInternal>[1]),
    fetchMyVisibleCodesInternal(pool, target as Parameters<typeof fetchMyVisibleCodesInternal>[1]),
    fetchMyClientCodes(pool, { id: target.id, role: target.role }),
    loadTrashedForScope(pool),
    catalogOverride
      ? Promise.resolve(null)
      : import("../server/dealers/dealers-trade-points-source.js").then((m) =>
          m.resolveDealersTradePointsList(pool, {}),
        ),
  ]);

  const catalogRows: DealerRow[] = catalogOverride ?? (await catalogFromDb)!.dealers;
  const snap = orgSnapshotFromInternal(orgInternal);
  const visPayload = visiblePayloadFromCodes(visInternal);
  const assignmentsScope = assignmentsScopeFromCodes({
    ownCodes: clientCodes.ownCodes,
    teamCodes: clientCodes.teamCodes,
    grantedCodes: clientCodes.grantedCodes,
  });

  const realScope = buildRealScopeForSidebarCounters({
    role,
    snap,
    visPayload,
    assignmentsScope: assignmentsScopeIsActive(assignmentsScope) ? assignmentsScope : undefined,
    catalogRows,
  });

  const actState = createEmptyActualizationState();
  actState.trashedDealersById = trashedDb.dealers;
  actState.trashedTradePointsById = trashedDb.tradePoints;

  const profile = profileForScopeCounters(target.id, role);
  const counters = computeSidebarScopeCountersFromRealScope(profile, role, realScope, actState, true);
  const teams = await loadUserTeams(pool, target.id);

  return {
    success: true,
    user: {
      id: target.id,
      email: target.email,
      full_name: target.full_name,
      role,
    },
    teams,
    scope: {
      own_client_codes: clientCodes.ownCodes,
      team_client_codes: clientCodes.teamCodes,
      granted_client_codes: clientCodes.grantedCodes,
      visible_dealer_count: counters.visibleDealerCount,
      visible_trade_point_count: counters.visibleTradePointCount,
      trashed_in_scope_count: counters.trashedInScopeCount,
      catalog_dealer_count: catalogRows.length,
      visible_codes_count: visInternal.all ? null : (visInternal.codes?.length ?? 0),
      assignments_active: assignmentsScopeIsActive(assignmentsScope),
    },
    explanation: buildExplanation(
      role,
      visInternal,
      {
        own: clientCodes.ownCodes,
        team: clientCodes.teamCodes,
        granted: clientCodes.grantedCodes,
      },
      {
        dealers: counters.visibleDealerCount,
        tps: counters.visibleTradePointCount,
        trash: counters.trashedInScopeCount,
        catalog: catalogRows.length,
      },
    ),
  };
}
