/**
 * Сервер: обогащение meta при записи trash/archive + RBAC на unTrash (Промт 398).
 */
import type { UserRole } from "./auth.js";
import type { PoolLike } from "./admin/admin-auth.js";
import {
  archiveMetaFromRecord,
  canMutateArchiveEntry,
  canMutateTrashEntry,
  trashMetaFromRecord,
  type ArchiveMeta,
  type TeamContext,
  type TrashMeta,
} from "./trash-archive-rbac.js";
import { fetchTeamContext } from "./team-context-handlers.js";

type TrashRecord = {
  trashedBy?: string;
  ownerTeamAtTrash?: string | null;
  ownerCode?: string | null;
  snapshot?: { dealerCode?: string | null };
};

type ArchiveRecord = {
  archivedBy?: string;
  ownerTeamAtArchive?: string | null;
  ownerCode?: string | null;
};

export async function loadTeamContextForUser(
  pool: PoolLike,
  userId: string,
  role: string,
): Promise<TeamContext> {
  const payload = await fetchTeamContext(pool, { id: userId, role });
  return {
    teamId: payload.teamId,
    teamMemberIds: payload.teamMemberIds,
    teamCodes: payload.teamCodes,
  };
}

export async function auditTrashArchiveAction(
  pool: PoolLike,
  actorId: string,
  action: string,
  targetKind: "dealer" | "trade_point",
  targetId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, metadata)
       VALUES ($1::uuid, $2, $3, $4, $5::jsonb)`,
      [actorId, action, targetKind, targetId, JSON.stringify(metadata)],
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.warn("[trash-archive-rbac] audit insert failed", m.slice(0, 200));
  }
}

export async function assertUnTrashAllowed(
  pool: PoolLike,
  actor: { id: string; role: UserRole },
  prevState: Record<string, unknown>,
  unTrash: { dealers?: string[]; tradePoints?: string[] },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const teamContext = await loadTeamContextForUser(pool, actor.id, actor.role);
  const dealers = unTrash.dealers ?? [];
  const tps = unTrash.tradePoints ?? [];
  const trashedMap = (prevState.trashedDealersById ?? {}) as Record<string, TrashRecord>;
  const tpMap = (prevState.trashedTradePointsById ?? {}) as Record<string, TrashRecord & { dealerId?: string }>;

  for (const id of dealers) {
    const rec = trashedMap[id];
    if (!rec) continue;
    const meta = trashMetaFromRecord(rec);
    if (!canMutateTrashEntry(actor.role, actor.id, teamContext, meta)) {
      return { ok: false, message: `Нет прав на восстановление клиента ${id}` };
    }
  }

  for (const tpId of tps) {
    const rec = tpMap[tpId];
    if (!rec) continue;
    const meta = trashMetaFromRecord(rec);
    if (!canMutateTrashEntry(actor.role, actor.id, teamContext, meta)) {
      return { ok: false, message: `Нет прав на восстановление ТТ ${tpId}` };
    }
  }

  return { ok: true };
}

export function enrichTrashArchiveMetaOnWrite(
  prevState: Record<string, unknown> | null,
  nextState: Record<string, unknown>,
  actor: { id: string; teamId: string | null },
): void {
  const prevTrash = (prevState?.trashedDealersById ?? {}) as Record<string, TrashRecord>;
  const nextTrash = (nextState.trashedDealersById ?? {}) as Record<string, TrashRecord>;
  for (const [id, rec] of Object.entries(nextTrash)) {
    if (!rec || typeof rec !== "object") continue;
    if (!rec.ownerTeamAtTrash && actor.teamId) rec.ownerTeamAtTrash = actor.teamId;
    if (!rec.ownerCode) {
      rec.ownerCode = rec.snapshot?.dealerCode ?? (id.replace(/^client-/i, "").toUpperCase() || null);
    }
    if (!prevTrash[id] && !rec.trashedBy) rec.trashedBy = actor.id;
  }

  const prevTp = (prevState?.trashedTradePointsById ?? {}) as Record<string, TrashRecord>;
  const nextTp = (nextState.trashedTradePointsById ?? {}) as Record<string, TrashRecord>;
  for (const [id, rec] of Object.entries(nextTp)) {
    if (!rec || typeof rec !== "object") continue;
    if (!rec.ownerTeamAtTrash && actor.teamId) rec.ownerTeamAtTrash = actor.teamId;
    if (!prevTp[id] && !rec.trashedBy) rec.trashedBy = actor.id;
  }

  const prevArch = (prevState?.archivedDealersById ?? {}) as Record<string, ArchiveRecord>;
  const nextArch = (nextState.archivedDealersById ?? {}) as Record<string, ArchiveRecord>;
  for (const [id, rec] of Object.entries(nextArch)) {
    if (!rec || typeof rec !== "object") continue;
    if (!rec.ownerTeamAtArchive && actor.teamId) rec.ownerTeamAtArchive = actor.teamId;
    if (!rec.ownerCode) rec.ownerCode = id.replace(/^client-/i, "").toUpperCase() || null;
    if (!prevArch[id] && !rec.archivedBy) rec.archivedBy = actor.id;
  }
}

export function archiveMetaFromStateRecord(rec: ArchiveRecord): ArchiveMeta {
  return archiveMetaFromRecord(rec);
}
