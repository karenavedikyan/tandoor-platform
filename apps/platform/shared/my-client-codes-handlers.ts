/**
 * GET /api/clients/my-codes — client_code из client_assignments для scope на /dealer-base.
 */
import type { PoolLike } from "./admin/admin-auth.js";

export type MyClientCodesMeta = {
  role: string;
  userId: string;
  isAdmin: boolean;
  isDirector: boolean;
  isRop: boolean;
  isManager: boolean;
};

export type MyClientCodesPayload = {
  success: true;
  ownCodes: string[];
  teamCodes: string[];
  /** client_code → responsible_user_id (БД), для агрегации карточек менеджеров. */
  responsibleByCode: Record<string, string>;
  /** client_code, выданные ропу через rop_client_grants (read-scope поверх own/team). */
  grantedCodes: string[];
  meta: MyClientCodesMeta;
};

type SessionUser = { id: string; role: string };

function buildMeta(userId: string, role: string): MyClientCodesMeta {
  return {
    role,
    userId,
    isAdmin: role === "admin",
    isDirector: role === "director",
    isRop: role === "rop",
    isManager: role === "manager" || role === "regional_manager",
  };
}

export async function fetchMyClientCodes(pool: PoolLike, user: SessionUser): Promise<MyClientCodesPayload> {
  const role = user.role;
  const uid = user.id;
  const meta = buildMeta(uid, role);

  if (role === "admin" || role === "director" || role === "analyst" || role === "marketer") {
    return { success: true, ownCodes: [], teamCodes: [], responsibleByCode: {}, grantedCodes: [], meta };
  }

  if (role === "rop") {
    const ownQ = await pool.query<{ client_code: string }>(
      `SELECT DISTINCT client_code FROM client_assignments WHERE responsible_user_id = $1::uuid ORDER BY client_code`,
      [uid],
    );
    const teamQ = await pool.query<{ client_code: string }>(
      `SELECT DISTINCT ca.client_code
       FROM client_assignments ca
       INNER JOIN teams t ON t.id = ca.team_id
       WHERE t.rop_user_id = $1::uuid
       ORDER BY ca.client_code`,
      [uid],
    );
    const responsibleQ = await pool.query<{ client_code: string; responsible_user_id: string }>(
      `SELECT DISTINCT ca.client_code, ca.responsible_user_id
       FROM client_assignments ca
       INNER JOIN teams t ON t.id = ca.team_id
       WHERE t.rop_user_id = $1::uuid`,
      [uid],
    );
    const responsibleByCode: Record<string, string> = {};
    for (const r of responsibleQ.rows) {
      if (r.client_code && r.responsible_user_id) responsibleByCode[r.client_code] = r.responsible_user_id;
    }
    const grantedQ = await pool.query<{ client_code: string }>(
      `SELECT DISTINCT client_code FROM rop_client_grants WHERE rop_user_id = $1::uuid ORDER BY client_code`,
      [uid],
    );
    return {
      success: true,
      ownCodes: ownQ.rows.map((r) => r.client_code).filter(Boolean),
      teamCodes: teamQ.rows.map((r) => r.client_code).filter(Boolean),
      responsibleByCode,
      grantedCodes: grantedQ.rows.map((r) => r.client_code).filter(Boolean),
      meta,
    };
  }

  if (role === "manager") {
    const ownQ = await pool.query<{ client_code: string }>(
      `SELECT DISTINCT client_code FROM client_assignments WHERE responsible_user_id = $1::uuid ORDER BY client_code`,
      [uid],
    );
    const ownCodes = ownQ.rows.map((r) => r.client_code).filter(Boolean);
    const responsibleByCode: Record<string, string> = {};
    for (const code of ownCodes) responsibleByCode[code] = uid;
    return {
      success: true,
      ownCodes,
      teamCodes: [],
      responsibleByCode,
      grantedCodes: [],
      meta,
    };
  }

  if (role === "regional_manager") {
    const ownQ = await pool.query<{ client_code: string }>(
      `SELECT DISTINCT upper(regexp_replace(dealer_id, '^client-', '')) AS client_code
       FROM dealer_overrides
       WHERE regional_manager_id = $1::uuid
       ORDER BY client_code`,
      [uid],
    );
    const ownCodes = ownQ.rows.map((r) => r.client_code).filter(Boolean);
    const responsibleByCode: Record<string, string> = {};
    for (const code of ownCodes) responsibleByCode[code] = uid;
    return {
      success: true,
      ownCodes,
      teamCodes: [],
      responsibleByCode,
      grantedCodes: [],
      meta,
    };
  }

  return { success: true, ownCodes: [], teamCodes: [], responsibleByCode: {}, grantedCodes: [], meta };
}
