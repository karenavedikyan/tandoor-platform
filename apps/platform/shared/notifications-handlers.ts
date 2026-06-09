/**
 * In-app notifications — чтение и пометка прочитанными (Промт 230d).
 */

type PoolLike = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number }>;
};

export type NotificationDto = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  entityKind: string | null;
  entityId: string | null;
  actorId: string | null;
  actorName: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
};

export class NotificationValidationError extends Error {
  readonly code: string;
  constructor(message: string, code = "VALIDATION_ERROR") {
    super(message);
    this.code = code;
  }
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return "";
}

function toIsoOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return toIso(v);
}

function mapRow(r: Record<string, unknown>): NotificationDto {
  return {
    id: String(r.id),
    kind: String(r.kind ?? ""),
    title: String(r.title ?? ""),
    body: (r.body as string) ?? null,
    link: (r.link as string) ?? null,
    entityKind: (r.entity_kind as string) ?? null,
    entityId: (r.entity_id as string) ?? null,
    actorId: r.actor_id ? String(r.actor_id) : null,
    actorName: (r.actor_name as string) ?? null,
    read: Boolean(r.read),
    readAt: toIsoOrNull(r.read_at),
    createdAt: toIso(r.created_at),
  };
}

async function countUnread(pool: PoolLike, userId: string): Promise<number> {
  const r = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM app_notifications WHERE user_id = $1::uuid AND read = false`,
    [userId],
  );
  return Number(r.rows[0]?.count ?? 0);
}

function clampLimit(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 30;
  const n = Math.floor(raw);
  if (n < 1) return 30;
  return Math.min(n, 100);
}

export async function handleList(
  pool: PoolLike,
  userId: string,
  opts?: { onlyUnread?: boolean; limit?: number },
): Promise<{ success: true; notifications: NotificationDto[]; unreadCount: number }> {
  const limit = clampLimit(opts?.limit);
  const onlyUnread = opts?.onlyUnread === true;

  const conds = ["user_id = $1::uuid"];
  const params: unknown[] = [userId];
  if (onlyUnread) {
    conds.push("read = false");
  }
  params.push(limit);

  const r = await pool.query<Record<string, unknown>>(
    `SELECT * FROM app_notifications
     WHERE ${conds.join(" AND ")}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params,
  );

  const unreadCount = await countUnread(pool, userId);
  return { success: true, notifications: r.rows.map(mapRow), unreadCount };
}

export async function handleUnreadCount(
  pool: PoolLike,
  userId: string,
): Promise<{ success: true; unreadCount: number }> {
  const unreadCount = await countUnread(pool, userId);
  return { success: true, unreadCount };
}

export async function handleMarkRead(
  pool: PoolLike,
  userId: string,
  ids: string[],
): Promise<{ success: true; updated: number }> {
  const clean = ids.map((id) => id.trim()).filter(Boolean);
  if (clean.length === 0) {
    return { success: true, updated: 0 };
  }

  const r = await pool.query(
    `UPDATE app_notifications
     SET read = true, read_at = now()
     WHERE user_id = $1::uuid AND id = ANY($2::uuid[]) AND read = false`,
    [userId, clean],
  );
  return { success: true, updated: r.rowCount ?? 0 };
}

export async function handleMarkAllRead(
  pool: PoolLike,
  userId: string,
): Promise<{ success: true; updated: number }> {
  const r = await pool.query(
    `UPDATE app_notifications
     SET read = true, read_at = now()
     WHERE user_id = $1::uuid AND read = false`,
    [userId],
  );
  return { success: true, updated: r.rowCount ?? 0 };
}
