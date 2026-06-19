/**
 * Формула scope из БД (Промт 384) — единый source of truth.
 * READ-only SQL: client_assignments, rop_client_grants, dealers, overrides.
 */

import type { UserRole } from "./auth.js";
import type { PoolLike } from "./responsibility-resolver.js";
import {
  dealerJoinStatusActive,
  dealerStatusPendingAdmin,
  tpJoinStatusActive,
  tpStatusPendingAdmin,
  tpStatusTrash,
} from "./record-status.js";

export type DbScopeCodesMeta = {
  fullCatalog: boolean;
  teamIds: string[];
  ownCodes: string[];
  teamCodes: string[];
  grantedCodes: string[];
  allCodes: string[];
};

export type DbScopeTotals = {
  active_dealers: number;
  active_trade_points: number;
  trashed_dealers: number;
  trashed_trade_points: number;
  admin_purge_queue_dealers?: number;
  admin_purge_queue_trade_points?: number;
};

export type DbScopeResult = {
  totals: DbScopeTotals;
  active_dealer_ids: string[];
  active_dealer_external_keys: string[];
  trashed_dealer_ids: string[];
  trashed_dealer_external_keys: string[];
  scope_explanation: {
    role: string;
    team_ids: string[];
    own_codes: number;
    team_codes: number;
    granted_codes: number;
    all_codes: number;
    full_catalog: boolean;
  };
};

const FULL_CATALOG_ROLES: ReadonlySet<UserRole> = new Set([
  "admin",
  "director",
  "analyst",
  "marketer",
  "category_manager",
]);

/** JOIN dealer_overrides по id / external_key / client-{release_code}. */
export const DEALER_OVERRIDE_JOIN = `
  LEFT JOIN dealer_overrides d_ov ON (
    d_ov.dealer_id = d.id::text
    OR d_ov.dealer_id = d.external_key
    OR (
      d.release_code IS NOT NULL
      AND lower(d_ov.dealer_id) = 'client-' || lower(d.release_code)
    )
  )
`;

/** JOIN trade_point_overrides по id / external_key. */
export const TRADE_POINT_OVERRIDE_JOIN = `
  LEFT JOIN trade_point_overrides tpo ON (
    tpo.tp_id = tp.id::text
    OR tpo.tp_id = tp.external_key
  )
`;

export type TrashRbacMode = "self" | "team" | "full";

export function resolveTrashRbacMode(role: UserRole): TrashRbacMode {
  if (role === "admin" || role === "director") return "full";
  if (role === "rop") return "team";
  return "self";
}

export async function fetchTeamMemberIds(pool: PoolLike, userId: string): Promise<Set<string>> {
  const q = await pool.query<{ user_id: string }>(
    `SELECT user_id::text FROM user_team_memberships
     WHERE team_id IN (SELECT team_id FROM user_team_memberships WHERE user_id = $1)`,
    [userId],
  );
  const ids = new Set<string>(q.rows.map((r) => r.user_id));
  ids.add(userId);
  return ids;
}

function dealerVisibleInTrash(
  trashedBy: string | null | undefined,
  mode: TrashRbacMode,
  userId: string,
  teamMemberIds: Set<string> | null,
): boolean {
  if (mode === "full") return true;
  if (mode === "self") return trashedBy === userId;
  if (mode === "team") return Boolean(trashedBy && teamMemberIds?.has(trashedBy));
  return false;
}

function buildTradePointTrashByFilter(
  mode: TrashRbacMode,
  userId: string,
  teamMemberIds: Set<string> | null,
): { sql: string; params: unknown[] } {
  if (mode === "self") {
    return { sql: "AND tpo.trashed_by = $2::uuid", params: [userId] };
  }
  if (mode === "team" && teamMemberIds) {
    return { sql: "AND tpo.trashed_by = ANY($2::uuid[])", params: [Array.from(teamMemberIds)] };
  }
  return { sql: "", params: [] };
}

export async function computeAdminPurgeQueueCounts(
  pool: PoolLike,
): Promise<{ dealers: number; trade_points: number }> {
  const dealersQ = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM dealer_overrides d_ov
     WHERE ${dealerStatusPendingAdmin("d_ov")}`,
  );
  const tpQ = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM trade_point_overrides tpo
     WHERE ${tpStatusPendingAdmin("tpo")}`,
  );
  return {
    dealers: Number(dealersQ.rows[0]?.n ?? 0),
    trade_points: Number(tpQ.rows[0]?.n ?? 0),
  };
}

export type AdminPurgeQueueDealerRow = {
  id: string;
  external_key: string;
  name: string;
  release_code: string | null;
  trashed_at: string | null;
  trashed_by: string | null;
  purge_requested_at: string | null;
  purge_requested_by: string | null;
  trashed_by_name: string | null;
  purge_requested_by_name: string | null;
};

export async function computeAdminPurgeQueue(pool: PoolLike): Promise<{
  dealers: AdminPurgeQueueDealerRow[];
  trade_points: Record<string, unknown>[];
}> {
  const dealersQ = await pool.query<AdminPurgeQueueDealerRow>(
    `SELECT d.id::text AS id, d.external_key, d.name, d.release_code,
            d_ov.trashed_at, d_ov.trashed_by::text,
            d_ov.purge_requested_at, d_ov.purge_requested_by::text,
            u_trashed.full_name AS trashed_by_name,
            u_requested.full_name AS purge_requested_by_name
     FROM dealers d
     ${DEALER_OVERRIDE_JOIN}
     LEFT JOIN users u_trashed ON u_trashed.id = d_ov.trashed_by
     LEFT JOIN users u_requested ON u_requested.id = d_ov.purge_requested_by
     WHERE ${dealerStatusPendingAdmin("d_ov")}
     ORDER BY d_ov.purge_requested_at DESC`,
  );
  const tpQ = await pool.query<Record<string, unknown>>(
    `SELECT tpo.tp_id, tpo.dealer_id, tpo.trashed_at, tpo.trashed_by::text,
            tpo.purge_requested_at, tpo.purge_requested_by::text,
            u_trashed.full_name AS trashed_by_name,
            u_requested.full_name AS purge_requested_by_name
     FROM trade_point_overrides tpo
     LEFT JOIN users u_trashed ON u_trashed.id = tpo.trashed_by
     LEFT JOIN users u_requested ON u_requested.id = tpo.purge_requested_by
     WHERE ${tpStatusPendingAdmin("tpo")}
     ORDER BY tpo.purge_requested_at DESC`,
  );
  return { dealers: dealersQ.rows, trade_points: tpQ.rows };
}

export async function resolveUserTeamIds(
  pool: PoolLike,
  userId: string,
  role: UserRole,
): Promise<string[]> {
  if (role === "rop") {
    const r = await pool.query<{ team_id: string }>(
      `SELECT DISTINCT t.id AS team_id
       FROM teams t
       WHERE t.rop_user_id = $1::uuid
       UNION
       SELECT DISTINCT m.team_id
       FROM user_team_memberships m
       WHERE m.user_id = $1::uuid`,
      [userId],
    );
    return r.rows.map((row) => row.team_id).filter(Boolean);
  }
  if (role === "regional_manager" || role === "manager") {
    const r = await pool.query<{ team_id: string }>(
      `SELECT DISTINCT team_id FROM user_team_memberships WHERE user_id = $1::uuid`,
      [userId],
    );
    return r.rows.map((row) => row.team_id).filter(Boolean);
  }
  return [];
}

export async function resolveScopeCodesMeta(
  pool: PoolLike,
  userId: string,
  role: UserRole,
): Promise<DbScopeCodesMeta> {
  if (FULL_CATALOG_ROLES.has(role)) {
    return {
      fullCatalog: true,
      teamIds: [],
      ownCodes: [],
      teamCodes: [],
      grantedCodes: [],
      allCodes: [],
    };
  }

  const teamIds = await resolveUserTeamIds(pool, userId, role);

  let ownCodes: string[] = [];
  if (role === "rop" || role === "manager" || role === "regional_manager") {
    const ownQ = await pool.query<{ client_code: string }>(
      `SELECT DISTINCT client_code FROM client_assignments WHERE responsible_user_id = $1::uuid ORDER BY client_code`,
      [userId],
    );
    ownCodes = ownQ.rows.map((r) => r.client_code).filter(Boolean);
  }

  let teamCodes: string[] = [];
  if ((role === "rop" || role === "regional_manager") && teamIds.length > 0) {
    const teamQ = await pool.query<{ client_code: string }>(
      `SELECT DISTINCT ca.client_code
       FROM client_assignments ca
       WHERE ca.team_id = ANY($1::uuid[])
       ORDER BY ca.client_code`,
      [teamIds],
    );
    teamCodes = teamQ.rows.map((r) => r.client_code).filter(Boolean);
  }

  let grantedCodes: string[] = [];
  if (role === "rop") {
    const grantedQ = await pool.query<{ client_code: string }>(
      `SELECT DISTINCT client_code FROM rop_client_grants WHERE rop_user_id = $1::uuid ORDER BY client_code`,
      [userId],
    );
    grantedCodes = grantedQ.rows.map((r) => r.client_code).filter(Boolean);
  }

  const allSet = new Set<string>([...ownCodes, ...teamCodes, ...grantedCodes]);
  return {
    fullCatalog: false,
    teamIds,
    ownCodes,
    teamCodes,
    grantedCodes,
    allCodes: Array.from(allSet).sort(),
  };
}

export async function computeDbScopeForUser(
  pool: PoolLike,
  userId: string,
  role: UserRole,
): Promise<DbScopeResult> {
  const meta = await resolveScopeCodesMeta(pool, userId, role);
  const adminQueue =
    role === "admin" || role === "director" ? await computeAdminPurgeQueueCounts(pool) : null;

  const attachAdminTotals = (totals: DbScopeTotals): DbScopeTotals => {
    if (!adminQueue) return totals;
    return {
      ...totals,
      admin_purge_queue_dealers: adminQueue.dealers,
      admin_purge_queue_trade_points: adminQueue.trade_points,
    };
  };

  if (meta.fullCatalog) {
    const dealersQ = await pool.query<{
      id: string;
      external_key: string;
      status: string | null;
      trashed_by: string | null;
    }>(
      `SELECT d.id::text AS id, d.external_key,
              d_ov.status::text AS status,
              d_ov.trashed_by::text AS trashed_by
       FROM dealers d
       ${DEALER_OVERRIDE_JOIN}`,
    );
    const activeIds: string[] = [];
    const activeKeys: string[] = [];
    const trashedIds: string[] = [];
    const trashedKeys: string[] = [];
    for (const row of dealersQ.rows) {
      const status = row.status ?? "active";
      if (status === "purged") continue;
      if (status === "in_trash") {
        trashedIds.push(row.id);
        trashedKeys.push(row.external_key);
      } else if (status === "active") {
        activeIds.push(row.id);
        activeKeys.push(row.external_key);
      }
    }

    const tpQ = await pool.query<{ active_tps: string; trashed_tps: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE tp.is_active = TRUE AND ${tpJoinStatusActive("tpo")})::text AS active_tps,
         COUNT(*) FILTER (WHERE ${tpStatusTrash("tpo")})::text AS trashed_tps
       FROM trade_points tp
       INNER JOIN dealers d ON d.id = tp.dealer_id
       ${DEALER_OVERRIDE_JOIN}
       ${TRADE_POINT_OVERRIDE_JOIN}
       WHERE ${dealerJoinStatusActive("d_ov")}`,
    );
    const activeTp = Number(tpQ.rows[0]?.active_tps ?? 0);
    const trashedTp = Number(tpQ.rows[0]?.trashed_tps ?? 0);

    return {
      totals: attachAdminTotals({
        active_dealers: activeIds.length,
        active_trade_points: activeTp,
        trashed_dealers: trashedIds.length,
        trashed_trade_points: trashedTp,
      }),
      active_dealer_ids: activeIds,
      active_dealer_external_keys: activeKeys,
      trashed_dealer_ids: trashedIds,
      trashed_dealer_external_keys: trashedKeys,
      scope_explanation: {
        role,
        team_ids: meta.teamIds,
        own_codes: 0,
        team_codes: 0,
        granted_codes: 0,
        all_codes: 0,
        full_catalog: true,
      },
    };
  }

  if (meta.allCodes.length === 0) {
    return {
      totals: attachAdminTotals({
        active_dealers: 0,
        active_trade_points: 0,
        trashed_dealers: 0,
        trashed_trade_points: 0,
      }),
      active_dealer_ids: [],
      active_dealer_external_keys: [],
      trashed_dealer_ids: [],
      trashed_dealer_external_keys: [],
      scope_explanation: {
        role,
        team_ids: meta.teamIds,
        own_codes: meta.ownCodes.length,
        team_codes: meta.teamCodes.length,
        granted_codes: meta.grantedCodes.length,
        all_codes: 0,
        full_catalog: false,
      },
    };
  }

  const dealersQ = await pool.query<{
    id: string;
    external_key: string;
    status: string | null;
    trashed_by: string | null;
  }>(
    `SELECT d.id::text AS id, d.external_key,
            d_ov.status::text AS status,
            d_ov.trashed_by::text AS trashed_by
     FROM dealers d
     ${DEALER_OVERRIDE_JOIN}
     WHERE d.release_code = ANY($1::text[])`,
    [meta.allCodes],
  );

  const trashRbacMode = resolveTrashRbacMode(role);
  const teamMemberIds =
    trashRbacMode === "team" ? await fetchTeamMemberIds(pool, userId) : null;

  const activeIds: string[] = [];
  const activeKeys: string[] = [];
  const trashedIds: string[] = [];
  const trashedKeys: string[] = [];
  for (const row of dealersQ.rows) {
    const status = row.status ?? "active";
    if (status === "purged") continue;
    if (status === "in_trash") {
      if (dealerVisibleInTrash(row.trashed_by, trashRbacMode, userId, teamMemberIds)) {
        trashedIds.push(row.id);
        trashedKeys.push(row.external_key);
      }
      continue;
    }
    if (status === "active") {
      activeIds.push(row.id);
      activeKeys.push(row.external_key);
    }
  }

  let activeTp = 0;
  let trashedTp = 0;
  const scopeDealerIds = [...activeIds, ...trashedIds];
  if (scopeDealerIds.length > 0) {
    const tpTrashFilter = buildTradePointTrashByFilter(trashRbacMode, userId, teamMemberIds);
    const tpQ = await pool.query<{ active_tps: string; trashed_tps: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE tp.is_active = TRUE AND ${tpJoinStatusActive("tpo")})::text AS active_tps,
         COUNT(*) FILTER (
           WHERE ${tpStatusTrash("tpo")}
             ${tpTrashFilter.sql}
         )::text AS trashed_tps
       FROM trade_points tp
       ${TRADE_POINT_OVERRIDE_JOIN}
       WHERE tp.dealer_id = ANY($1::uuid[])`,
      [scopeDealerIds, ...tpTrashFilter.params],
    );
    activeTp = Number(tpQ.rows[0]?.active_tps ?? 0);
    trashedTp = Number(tpQ.rows[0]?.trashed_tps ?? 0);
  }

  return {
    totals: attachAdminTotals({
      active_dealers: activeIds.length,
      active_trade_points: activeTp,
      trashed_dealers: trashedIds.length,
      trashed_trade_points: trashedTp,
    }),
    active_dealer_ids: activeIds,
    active_dealer_external_keys: activeKeys,
    trashed_dealer_ids: trashedIds,
    trashed_dealer_external_keys: trashedKeys,
    scope_explanation: {
      role,
      team_ids: meta.teamIds,
      own_codes: meta.ownCodes.length,
      team_codes: meta.teamCodes.length,
      granted_codes: meta.grantedCodes.length,
      all_codes: meta.allCodes.length,
      full_catalog: false,
    },
  };
}
