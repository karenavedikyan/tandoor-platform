/**
 * Запись ошибок записи overrides в Postgres (Промт 113.1).
 */

import type { PoolLike } from "./admin/admin-auth.js";

export async function logOverridesWriteError(
  pool: PoolLike,
  args: {
    entityKind: string;
    entityId: string;
    payload: unknown;
    errorMessage: string;
    actorUserId?: string | null;
  },
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO overrides_write_errors (entity_kind, entity_id, payload, error_message, actor_user_id)
       VALUES ($1, $2, $3::jsonb, $4, $5::uuid)`,
      [
        args.entityKind,
        args.entityId,
        JSON.stringify(args.payload ?? {}),
        args.errorMessage.slice(0, 4000),
        args.actorUserId ?? null,
      ],
    );
  } catch (e) {
    console.error("[overrides-write-errors] failed to log", e);
  }
}

export async function runOverridesHandlerSafe<T>(
  pool: PoolLike,
  entityKind: string,
  entityId: string,
  payload: unknown,
  actorUserId: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logOverridesWriteError(pool, {
      entityKind,
      entityId,
      payload,
      errorMessage: msg,
      actorUserId,
    });
    throw e;
  }
}
