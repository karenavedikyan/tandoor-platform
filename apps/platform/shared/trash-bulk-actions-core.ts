/**
 * Промт 404: RBAC-фильтры bulk restore / request-purge в корзине.
 * Опирается только на dealer_overrides / trade_point_overrides (trashed_by uuid) + user_team_memberships.
 */
import type { PoolLike } from "./admin/admin-auth.js";
import { dealerStatusTrash, tpStatusTrash } from "./record-status.js";

export const BULK_TRASH_MAX_IDS = 5000;
export const BULK_TRASH_SQL_CHUNK = 500;

export type BulkTrashFilterResult = {
  allowed: string[];
  skipped: number;
  skippedIds: string[];
};

function isAdminDirector(role: string): boolean {
  return role === "admin" || role === "director";
}

export function chunkIds(ids: string[], size = BULK_TRASH_SQL_CHUNK): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export async function resolveTeamMemberIds(
  pool: PoolLike,
  me: { id: string; role: string },
): Promise<Set<string>> {
  const ids = new Set<string>([me.id]);
  if (me.role !== "rop" && me.role !== "regional_manager") return ids;

  const teamIds = new Set<string>();
  const utm = await pool.query<{ team_id: string }>(
    `SELECT DISTINCT team_id FROM user_team_memberships WHERE user_id = $1::uuid`,
    [me.id],
  );
  for (const row of utm.rows) teamIds.add(row.team_id);
  if (me.role === "rop") {
    const ropTeams = await pool.query<{ id: string }>(
      `SELECT id FROM teams WHERE rop_user_id = $1::uuid`,
      [me.id],
    );
    for (const row of ropTeams.rows) teamIds.add(row.id);
  }
  if (teamIds.size > 0) {
    const members = await pool.query<{ user_id: string }>(
      `SELECT DISTINCT user_id::text AS user_id FROM user_team_memberships WHERE team_id = ANY($1::uuid[])`,
      [[...teamIds]],
    );
    for (const row of members.rows) ids.add(row.user_id);
  }
  return ids;
}

function trashedByAllowed(
  me: { id: string; role: string },
  trashedBy: string | null,
  teamMemberIds: Set<string>,
): boolean {
  if (!trashedBy) return false;
  if (isAdminDirector(me.role)) return true;
  if (me.role === "manager") return trashedBy === me.id;
  if (me.role === "rop" || me.role === "regional_manager") {
    return trashedBy === me.id || teamMemberIds.has(trashedBy);
  }
  return trashedBy === me.id;
}

type OverrideTrashRow = { entity_id: string; trashed_by: string | null };

async function fetchDealerTrashRows(pool: PoolLike, ids: string[]): Promise<OverrideTrashRow[]> {
  const r = await pool.query<{ dealer_id: string; trashed_by: string | null }>(
    `SELECT dealer_id, trashed_by::text AS trashed_by
     FROM dealer_overrides
     WHERE dealer_id = ANY($1::text[])
       AND ${dealerStatusTrash("dealer_overrides")}`,
    [ids],
  );
  return r.rows.map((row) => ({ entity_id: row.dealer_id, trashed_by: row.trashed_by }));
}

async function fetchTradePointTrashRows(pool: PoolLike, ids: string[]): Promise<OverrideTrashRow[]> {
  const r = await pool.query<{ tp_id: string; trashed_by: string | null }>(
    `SELECT tp_id, trashed_by::text AS trashed_by
     FROM trade_point_overrides
     WHERE tp_id = ANY($1::text[])
       AND ${tpStatusTrash("trade_point_overrides")}`,
    [ids],
  );
  return r.rows.map((row) => ({ entity_id: row.tp_id, trashed_by: row.trashed_by }));
}

function filterRowsByRbac(
  me: { id: string; role: string },
  ids: string[],
  rows: OverrideTrashRow[],
  teamMemberIds: Set<string>,
): BulkTrashFilterResult {
  const rowById = new Map(rows.map((row) => [row.entity_id, row]));
  const allowed: string[] = [];
  const skippedIds: string[] = [];
  for (const id of ids) {
    const row = rowById.get(id);
    if (row && trashedByAllowed(me, row.trashed_by, teamMemberIds)) allowed.push(id);
    else skippedIds.push(id);
  }
  return { allowed, skipped: skippedIds.length, skippedIds };
}

export async function filterTrashedDealerIdsForBulk(
  pool: PoolLike,
  me: { id: string; role: string },
  ids: string[],
): Promise<BulkTrashFilterResult> {
  if (ids.length === 0) return { allowed: [], skipped: 0, skippedIds: [] };
  const teamMemberIds = await resolveTeamMemberIds(pool, me);
  const rows: OverrideTrashRow[] = [];
  for (const chunk of chunkIds(ids)) {
    rows.push(...(await fetchDealerTrashRows(pool, chunk)));
  }
  return filterRowsByRbac(me, ids, rows, teamMemberIds);
}

export async function filterTrashedDealerIdsForPurge(
  pool: PoolLike,
  me: { id: string; role: string },
  ids: string[],
): Promise<BulkTrashFilterResult> {
  return filterTrashedDealerIdsForBulk(pool, me, ids);
}

export async function filterTrashedTradePointIdsForBulk(
  pool: PoolLike,
  me: { id: string; role: string },
  ids: string[],
): Promise<BulkTrashFilterResult> {
  if (ids.length === 0) return { allowed: [], skipped: 0, skippedIds: [] };
  const teamMemberIds = await resolveTeamMemberIds(pool, me);
  const rows: OverrideTrashRow[] = [];
  for (const chunk of chunkIds(ids)) {
    rows.push(...(await fetchTradePointTrashRows(pool, chunk)));
  }
  return filterRowsByRbac(me, ids, rows, teamMemberIds);
}

export async function filterTrashedTradePointIdsForPurge(
  pool: PoolLike,
  me: { id: string; role: string },
  ids: string[],
): Promise<BulkTrashFilterResult> {
  return filterTrashedTradePointIdsForBulk(pool, me, ids);
}

export async function removeDealersFromInitiatorTrashBlob(
  pool: PoolLike,
  userId: string,
  dealerIds: string[],
): Promise<void> {
  if (dealerIds.length === 0) return;
  const scopeKey = `user:${userId}`;
  for (const chunk of chunkIds(dealerIds)) {
    await pool.query(
      `UPDATE client_base_actualization_state
         SET state = jsonb_set(
                       state,
                       '{trashedDealersById}',
                       COALESCE(state->'trashedDealersById', '{}'::jsonb) - $1::text[],
                       true
                     ),
             updated_at = NOW(),
             version = version + 1
       WHERE (scope_key = $2 OR user_id::text = $3)
         AND jsonb_typeof(state->'trashedDealersById') = 'object'`,
      [chunk, scopeKey, userId],
    );
  }
}

export async function removeTradePointsFromInitiatorTrashBlob(
  pool: PoolLike,
  userId: string,
  tradePointIds: string[],
): Promise<void> {
  if (tradePointIds.length === 0) return;
  const scopeKey = `user:${userId}`;
  for (const chunk of chunkIds(tradePointIds)) {
    await pool.query(
      `UPDATE client_base_actualization_state
         SET state = jsonb_set(
                       state,
                       '{trashedTradePointsById}',
                       COALESCE(state->'trashedTradePointsById', '{}'::jsonb) - $1::text[],
                       true
                     ),
             updated_at = NOW(),
             version = version + 1
       WHERE (scope_key = $2 OR user_id::text = $3)
         AND jsonb_typeof(state->'trashedTradePointsById') = 'object'`,
      [chunk, scopeKey, userId],
    );
  }
}

export async function logBulkTrashAudit(
  pool: PoolLike,
  actorId: string,
  action: string,
  entityType: "dealer" | "trade_point",
  entityIds: string[],
): Promise<void> {
  if (entityIds.length === 0) return;
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb)`,
      [actorId, action, entityType, "bulk", JSON.stringify({ ids: entityIds })],
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.warn("[trash-bulk-actions] audit insert failed", m.slice(0, 200));
  }
}
