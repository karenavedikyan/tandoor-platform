/**
 * Промт 403: общие утилиты bulk move archive → trash.
 */
import type { PoolLike } from "./admin/admin-auth.js";
import { loadTeamContextForUser } from "./trash-archive-mutation-guard.js";

export const TRASH_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

export function computeTrashExpiresAt(trashedAtIso: string): string {
  const t = Date.parse(trashedAtIso);
  const base = Number.isFinite(t) ? t : Date.now();
  return new Date(base + TRASH_RETENTION_MS).toISOString();
}

export function parseEntityIdArray(body: unknown, field: string): string[] {
  const raw = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>)[field] : null;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function isAdminDirector(role: string): boolean {
  return role === "admin" || role === "director";
}

export async function resolveArchiveScopeUserIds(
  pool: PoolLike,
  me: { id: string; role: string },
): Promise<string[] | null> {
  if (isAdminDirector(me.role)) return null;
  if (me.role === "manager") return [me.id];

  if (me.role === "rop" || me.role === "regional_manager") {
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
    const userIds = new Set<string>([me.id]);
    if (teamIds.size > 0) {
      const members = await pool.query<{ user_id: string }>(
        `SELECT DISTINCT user_id::text AS user_id FROM user_team_memberships WHERE team_id = ANY($1::uuid[])`,
        [[...teamIds]],
      );
      for (const row of members.rows) userIds.add(row.user_id);
    }
    return [...userIds];
  }

  return [me.id];
}

export async function filterArchivedIdsForBulkMove(
  pool: PoolLike,
  me: { id: string; role: string },
  ids: string[],
  archiveField: "archivedDealersById" | "archivedTradePointsById",
): Promise<string[]> {
  if (ids.length === 0) return [];
  if (isAdminDirector(me.role)) return ids;

  if (me.role === "manager") {
    const r = await pool.query<{ entity_id: string }>(
      `SELECT k AS entity_id FROM (
         SELECT jsonb_object_keys(state->'${archiveField}') AS k
         FROM client_base_actualization_state
         WHERE user_id::text = $1
           AND jsonb_typeof(state->'${archiveField}') = 'object'
       ) t WHERE k = ANY($2::text[])`,
      [me.id, ids],
    );
    return r.rows.map((row) => row.entity_id);
  }

  const scopeUserIds = await resolveArchiveScopeUserIds(pool, me);
  if (!scopeUserIds || scopeUserIds.length === 0) return [];
  const r = await pool.query<{ entity_id: string }>(
    `SELECT DISTINCT k AS entity_id
     FROM client_base_actualization_state s,
     LATERAL jsonb_object_keys(s.state->'${archiveField}') AS k
     WHERE s.user_id::text = ANY($1::text[])
       AND jsonb_typeof(s.state->'${archiveField}') = 'object'
       AND k = ANY($2::text[])`,
    [scopeUserIds, ids],
  );
  return r.rows.map((row) => row.entity_id);
}

export async function excludePurgePendingIds(
  pool: PoolLike,
  ids: string[],
  table: "dealer_overrides" | "trade_point_overrides",
  idColumn: "dealer_id" | "tp_id",
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const r = await pool.query<Record<string, string>>(
    `SELECT ${idColumn} FROM ${table}
     WHERE ${idColumn} = ANY($1::text[])
       AND status = 'pending_admin'`,
    [ids],
  );
  return new Set(r.rows.map((row) => row[idColumn]));
}

export async function fetchActorDisplayName(pool: PoolLike, userId: string): Promise<string> {
  const r = await pool.query<{ full_name: string | null; email: string | null }>(
    `SELECT full_name, email FROM users WHERE id = $1::uuid LIMIT 1`,
    [userId],
  );
  const row = r.rows[0];
  return row?.full_name?.trim() || row?.email?.trim() || "—";
}

function jsonFieldStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function readFields(state: Record<string, unknown>, entityId: string, fieldsKey: string, manualKey: string): Record<string, unknown> {
  const override = (state[fieldsKey] as Record<string, { fields?: Record<string, unknown> }> | undefined)?.[entityId];
  const manual = (state[manualKey] as Record<string, { fields?: Record<string, unknown>; internalCode?: string }> | undefined)?.[entityId];
  return { ...(override?.fields ?? {}), ...(manual?.fields ?? {}) };
}

export type DealerTrashEntry = {
  dealerId: string;
  trashedAt: string;
  trashedBy: string;
  trashedByName: string;
  expiresAt: string;
  source: "client_bulk_delete";
  ownerTeamAtTrash: string | null;
  ownerCode: string | null;
  snapshot: {
    fullName: string | null;
    city: string | null;
    inn: string | null;
    dealerCode: string | null;
    legalEntityName: string | null;
  };
};

export type TradePointTrashEntry = {
  tradePointId: string;
  dealerId: string;
  trashedAt: string;
  trashedBy: string;
  trashedByName: string;
  expiresAt: string;
  source: "client_bulk_delete";
  ownerTeamAtTrash: string | null;
  ownerCode: string | null;
  snapshot: {
    name: string | null;
    address: string | null;
    city: string | null;
    tradePointCode: string | null;
    dealerFullName: string | null;
  };
};

export async function buildDealerTrashEntries(
  pool: PoolLike,
  dealerIds: string[],
  me: { id: string; role: string },
  actorName: string,
): Promise<Record<string, DealerTrashEntry>> {
  if (dealerIds.length === 0) return {};
  const teamContext = await loadTeamContextForUser(pool, me.id, me.role);
  const teamId = teamContext.teamId;
  const trashedAt = new Date().toISOString();
  const expiresAt = computeTrashExpiresAt(trashedAt);

  const r = await pool.query<{
    dealer_id: string;
    archived_entry: Record<string, unknown> | null;
    full_state: Record<string, unknown>;
  }>(
    `SELECT DISTINCT ON (dealer_id)
            dealer_id,
            archived_entry,
            full_state
       FROM (
         SELECT k AS dealer_id,
                s.state->'archivedDealersById'->k AS archived_entry,
                s.state AS full_state
         FROM client_base_actualization_state s,
         LATERAL jsonb_object_keys(s.state->'archivedDealersById') AS k
         WHERE k = ANY($1::text[])
           AND jsonb_typeof(s.state->'archivedDealersById') = 'object'
       ) sub
       ORDER BY dealer_id`,
    [dealerIds],
  );

  const found = new Map(r.rows.map((row) => [row.dealer_id, row]));
  const out: Record<string, DealerTrashEntry> = {};

  for (const dealerId of dealerIds) {
    const row = found.get(dealerId);
    const archived = row?.archived_entry ?? null;
    const state = row?.full_state ?? {};
    const fields = readFields(state, dealerId, "dealerOverridesById", "manuallyCreatedDealersById");
    const manual = (state.manuallyCreatedDealersById as Record<string, { internalCode?: string }> | undefined)?.[dealerId];
    const ownerCode =
      jsonFieldStr(archived?.ownerCode) ||
      manual?.internalCode?.trim() ||
      dealerId.replace(/^client-/i, "").toUpperCase() ||
      null;

    out[dealerId] = {
      dealerId,
      trashedAt,
      trashedBy: me.id,
      trashedByName: actorName,
      expiresAt,
      source: "client_bulk_delete",
      ownerTeamAtTrash: teamId,
      ownerCode,
      snapshot: {
        fullName: jsonFieldStr(fields.name) || null,
        city: jsonFieldStr(fields.city) || null,
        inn: jsonFieldStr(fields.inn) || null,
        dealerCode: manual?.internalCode?.trim() || jsonFieldStr(fields.dealerCode) || ownerCode,
        legalEntityName: jsonFieldStr(fields.legalEntityName) || null,
      },
    };
  }

  return out;
}

export async function buildTradePointTrashEntries(
  pool: PoolLike,
  tradePointIds: string[],
  me: { id: string; role: string },
  actorName: string,
): Promise<Record<string, TradePointTrashEntry>> {
  if (tradePointIds.length === 0) return {};
  const teamContext = await loadTeamContextForUser(pool, me.id, me.role);
  const teamId = teamContext.teamId;
  const trashedAt = new Date().toISOString();
  const expiresAt = computeTrashExpiresAt(trashedAt);

  const r = await pool.query<{
    trade_point_id: string;
    archived_entry: Record<string, unknown> | null;
    full_state: Record<string, unknown>;
  }>(
    `SELECT DISTINCT ON (trade_point_id)
            trade_point_id,
            archived_entry,
            full_state
       FROM (
         SELECT k AS trade_point_id,
                s.state->'archivedTradePointsById'->k AS archived_entry,
                s.state AS full_state
         FROM client_base_actualization_state s,
         LATERAL jsonb_object_keys(s.state->'archivedTradePointsById') AS k
         WHERE k = ANY($1::text[])
           AND jsonb_typeof(s.state->'archivedTradePointsById') = 'object'
       ) sub
       ORDER BY trade_point_id`,
    [tradePointIds],
  );

  const found = new Map(r.rows.map((row) => [row.trade_point_id, row]));
  const out: Record<string, TradePointTrashEntry> = {};

  for (const tradePointId of tradePointIds) {
    const row = found.get(tradePointId);
    const archived = row?.archived_entry ?? null;
    const state = row?.full_state ?? {};
    const dealerId = jsonFieldStr(archived?.dealerId) || tradePointId;
    const fields = readFields(state, tradePointId, "tradePointOverridesById", "manuallyCreatedTradePointsById");
    const manual = (state.manuallyCreatedTradePointsById as Record<string, { internalCode?: string }> | undefined)?.[
      tradePointId
    ];
    const ownerCode = jsonFieldStr(archived?.ownerCode) || manual?.internalCode?.trim() || null;

    out[tradePointId] = {
      tradePointId,
      dealerId,
      trashedAt,
      trashedBy: me.id,
      trashedByName: actorName,
      expiresAt,
      source: "client_bulk_delete",
      ownerTeamAtTrash: teamId,
      ownerCode,
      snapshot: {
        name: jsonFieldStr(fields.name) || null,
        address: jsonFieldStr(fields.address) || null,
        city: jsonFieldStr(fields.city) || null,
        tradePointCode: manual?.internalCode?.trim() || jsonFieldStr(fields.tradePointCode) || null,
        dealerFullName: null,
      },
    };
  }

  return out;
}

export async function countArchivedByOwner(
  pool: PoolLike,
  ids: string[],
  archiveField: "archivedDealersById" | "archivedTradePointsById",
): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  const r = await pool.query<{ user_id: string; cnt: string }>(
    `SELECT s.user_id::text AS user_id, COUNT(DISTINCT k)::text AS cnt
     FROM client_base_actualization_state s,
     LATERAL jsonb_object_keys(s.state->'${archiveField}') AS k
     WHERE k = ANY($1::text[])
       AND jsonb_typeof(s.state->'${archiveField}') = 'object'
     GROUP BY s.user_id`,
    [ids],
  );
  const out: Record<string, number> = {};
  for (const row of r.rows) out[row.user_id] = Number(row.cnt) || 0;
  return out;
}

export async function removeFromArchivedStates(
  pool: PoolLike,
  ids: string[],
  archiveField: "archivedDealersById" | "archivedTradePointsById",
  scopeUserIds: string[] | null,
): Promise<void> {
  if (ids.length === 0) return;
  await pool.query(
    `UPDATE client_base_actualization_state
        SET state = jsonb_set(
                      state,
                      '{${archiveField}}',
                      COALESCE(state->'${archiveField}', '{}'::jsonb) - $1::text[],
                      true
                    ),
            updated_at = NOW(),
            version = version + 1
      WHERE jsonb_typeof(state->'${archiveField}') = 'object'
        AND ($2::text[] IS NULL OR user_id::text = ANY($2::text[]))`,
    [ids, scopeUserIds],
  );
}

export async function mergeTrashIntoInitiatorState(
  pool: PoolLike,
  me: { id: string; role: string },
  trashField: "trashedDealersById" | "trashedTradePointsById",
  trashEntries: Record<string, unknown>,
): Promise<void> {
  if (Object.keys(trashEntries).length === 0) return;
  const scopeKey = `user:${me.id}`;
  await pool.query(
    `INSERT INTO client_base_actualization_state (id, scope_key, user_id, role, state, version, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, jsonb_build_object('${trashField}', $4::jsonb), 1, NOW(), NOW())
     ON CONFLICT (scope_key) DO UPDATE
       SET state = jsonb_set(
                     client_base_actualization_state.state,
                     '{${trashField}}',
                     COALESCE(client_base_actualization_state.state->'${trashField}', '{}'::jsonb) || $4::jsonb,
                     true
                   ),
           updated_at = NOW(),
           version = client_base_actualization_state.version + 1`,
    [scopeKey, me.id, me.role, JSON.stringify(trashEntries)],
  );
}
