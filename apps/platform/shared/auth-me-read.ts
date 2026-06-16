/**
 * Чтение auth/me payload для bootstrap и кэшируемых GET (Промт 380).
 */

import type { PoolLike } from "./admin/admin-auth.js";
import { parseAuthRefreshToken, sha256Hex, timingSafeEqualHex } from "./admin/admin-auth.js";
import { publicUserDtoFromRow } from "./auth-session-scope.js";
import type { DbUserRow } from "./admin/admin-auth.js";

export type AuthMePayload = {
  success: true;
  user: Record<string, unknown>;
};

export async function resolveSessionUserRow(
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<DbUserRow | null> {
  const token = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!token) return null;
  const hashHex = sha256Hex(token);
  const res = await pool.query<DbUserRow & { refresh_token_hash: string }>(
    `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.status, u.must_change_password, u.last_login_at, u.created_at,
            s.refresh_token_hash
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
     LIMIT 1`,
    [hashHex],
  );
  const row = res.rows[0];
  if (!row || !timingSafeEqualHex(row.refresh_token_hash, token)) return null;
  const { refresh_token_hash: _h, ...u } = row;
  return u;
}

export async function buildAuthMePayload(
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
): Promise<AuthMePayload | { success: false; code: string }> {
  const token = parseAuthRefreshToken(typeof headers.cookie === "string" ? headers.cookie : undefined);
  if (!token) {
    return { success: false, code: "UNAUTHENTICATED" };
  }
  const hashHex = sha256Hex(token);
  const res = await pool.query<
    DbUserRow & {
      refresh_token_hash: string;
      impersonator_full_name: string | null;
      impersonator_email: string | null;
    }
  >(
    `SELECT u.id, u.email, u.full_name, u.phone, u.role, u.status, u.must_change_password, u.last_login_at, u.created_at,
            s.refresh_token_hash,
            imp.full_name AS impersonator_full_name,
            imp.email AS impersonator_email
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     LEFT JOIN users imp ON imp.id = s.impersonator_user_id
     WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
     LIMIT 1`,
    [hashHex],
  );
  const row = res.rows[0];
  if (!row || !timingSafeEqualHex(row.refresh_token_hash, token)) {
    return { success: false, code: "UNAUTHENTICATED" };
  }
  const { refresh_token_hash: _h, impersonator_full_name, impersonator_email, ...u } = row;
  let impersonatedBy: string | null = null;
  if (impersonator_full_name && impersonator_email) {
    impersonatedBy = `${impersonator_full_name} · ${impersonator_email}`;
  }
  return {
    success: true,
    user: { ...publicUserDtoFromRow(u), impersonatedBy },
  };
}
