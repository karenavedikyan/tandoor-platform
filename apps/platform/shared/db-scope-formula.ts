/**
 * Формула scope из БД (Промт 384) — единый source of truth.
 * READ-only SQL: client_assignments, rop_client_grants, dealers, overrides.
 */

import type { UserRole } from "./auth.js";
import type { PoolLike } from "./responsibility-resolver.js";

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

  if (meta.fullCatalog) {
    const dealersQ = await pool.query<{
      id: string;
      external_key: string;
      is_trashed: boolean;
    }>(
      `SELECT d.id::text AS id, d.external_key, (d_ov.trashed_at IS NOT NULL) AS is_trashed
       FROM dealers d
       ${DEALER_OVERRIDE_JOIN}`,
    );
    const activeIds: string[] = [];
    const activeKeys: string[] = [];
    const trashedIds: string[] = [];
    const trashedKeys: string[] = [];
    for (const row of dealersQ.rows) {
      if (row.is_trashed) {
        trashedIds.push(row.id);
        trashedKeys.push(row.external_key);
      } else {
        activeIds.push(row.id);
        activeKeys.push(row.external_key);
      }
    }

    const tpQ = await pool.query<{ active_tps: string; trashed_tps: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE tpo.trashed_at IS NULL)::text AS active_tps,
         COUNT(*) FILTER (WHERE tpo.trashed_at IS NOT NULL)::text AS trashed_tps
       FROM trade_points tp
       INNER JOIN dealers d ON d.id = tp.dealer_id
       ${DEALER_OVERRIDE_JOIN}
       ${TRADE_POINT_OVERRIDE_JOIN}
       WHERE d_ov.trashed_at IS NULL`,
    );
    const activeTp = Number(tpQ.rows[0]?.active_tps ?? 0);
    const trashedTp = Number(tpQ.rows[0]?.trashed_tps ?? 0);

    return {
      totals: {
        active_dealers: activeIds.length,
        active_trade_points: activeTp,
        trashed_dealers: trashedIds.length,
        trashed_trade_points: trashedTp,
      },
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
      totals: {
        active_dealers: 0,
        active_trade_points: 0,
        trashed_dealers: 0,
        trashed_trade_points: 0,
      },
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
    is_trashed: boolean;
  }>(
    `SELECT d.id::text AS id, d.external_key, (d_ov.trashed_at IS NOT NULL) AS is_trashed
     FROM dealers d
     ${DEALER_OVERRIDE_JOIN}
     WHERE d.release_code = ANY($1::text[])`,
    [meta.allCodes],
  );

  const activeIds: string[] = [];
  const activeKeys: string[] = [];
  const trashedIds: string[] = [];
  const trashedKeys: string[] = [];
  for (const row of dealersQ.rows) {
    if (row.is_trashed) {
      trashedIds.push(row.id);
      trashedKeys.push(row.external_key);
    } else {
      activeIds.push(row.id);
      activeKeys.push(row.external_key);
    }
  }

  let activeTp = 0;
  let trashedTp = 0;
  if (activeIds.length > 0) {
    const tpQ = await pool.query<{ active_tps: string; trashed_tps: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE tpo.trashed_at IS NULL)::text AS active_tps,
         COUNT(*) FILTER (WHERE tpo.trashed_at IS NOT NULL)::text AS trashed_tps
       FROM trade_points tp
       ${TRADE_POINT_OVERRIDE_JOIN}
       WHERE tp.dealer_id = ANY($1::uuid[])`,
      [activeIds],
    );
    activeTp = Number(tpQ.rows[0]?.active_tps ?? 0);
    trashedTp = Number(tpQ.rows[0]?.trashed_tps ?? 0);
  }

  return {
    totals: {
      active_dealers: activeIds.length,
      active_trade_points: activeTp,
      trashed_dealers: trashedIds.length,
      trashed_trade_points: trashedTp,
    },
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
