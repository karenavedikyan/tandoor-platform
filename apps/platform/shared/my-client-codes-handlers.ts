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
    return { success: true, ownCodes: [], teamCodes: [], meta };
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
    return {
      success: true,
      ownCodes: ownQ.rows.map((r) => r.client_code).filter(Boolean),
      teamCodes: teamQ.rows.map((r) => r.client_code).filter(Boolean),
      meta,
    };
  }

  if (role === "manager" || role === "regional_manager") {
    const ownQ = await pool.query<{ client_code: string }>(
      `SELECT DISTINCT client_code FROM client_assignments WHERE responsible_user_id = $1::uuid ORDER BY client_code`,
      [uid],
    );
    return {
      success: true,
      ownCodes: ownQ.rows.map((r) => r.client_code).filter(Boolean),
      teamCodes: [],
      meta,
    };
  }

  return { success: true, ownCodes: [], teamCodes: [], meta };
}
