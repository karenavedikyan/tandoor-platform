/**
 * Права на внесение дистрибуции 1С по торговой точке.
 */

import type { PoolLike } from "./admin/admin-auth.js";
import { nameMatches } from "./one-c-name-matching.js";
import { loadOneCShowroomContext, teamContextForUser } from "./one-c-showroom-context.js";

export type OneCDistributionUser = {
  id: string;
  role: string;
  status: string;
  full_name: string;
};

export async function fetchStoreLegalManagerNames(
  pool: PoolLike,
  storeId1c: string,
): Promise<{ regional_manager_name: string | null; responsible_manager_name: string | null } | null> {
  const res = await pool.query<{
    regional_manager_name: string | null;
    responsible_manager_name: string | null;
  }>(
    `SELECT l.regional_manager_name, l.responsible_manager_name
     FROM exchange_stores_raw s
     LEFT JOIN exchange_legals_raw l ON l.id_1c = s.legal_entity_1c
     WHERE s.id_1c = $1::uuid
     LIMIT 1`,
    [storeId1c],
  );
  return res.rows[0] ?? null;
}

export function canEditDistributionForStore1cSync(
  user: OneCDistributionUser,
  names: { regional_manager_name: string | null; responsible_manager_name: string | null },
  ropTeamRmFullNames: string[],
): boolean {
  if (user.status !== "active") return false;
  if (user.role === "admin" || user.role === "director") return true;

  const regName = names.regional_manager_name;
  const respName = names.responsible_manager_name;

  if (user.role === "regional_manager" && regName && nameMatches(user.full_name, regName)) {
    return true;
  }
  if (user.role === "manager" && respName && nameMatches(user.full_name, respName)) {
    return true;
  }
  if (user.role === "rop" && regName) {
    for (const rmName of ropTeamRmFullNames) {
      if (nameMatches(rmName, regName)) return true;
    }
  }
  return false;
}

export async function canEditDistributionForStore1c(
  pool: PoolLike,
  userId: string,
  storeId1c: string,
): Promise<boolean> {
  const userRes = await pool.query<OneCDistributionUser>(
    `SELECT id::text AS id, role::text AS role, status, full_name
     FROM users WHERE id = $1::uuid LIMIT 1`,
    [userId],
  );
  const user = userRes.rows[0];
  if (!user) return false;

  const names = await fetchStoreLegalManagerNames(pool, storeId1c);
  if (!names) return false;

  let ropTeamRmFullNames: string[] = [];
  if (user.role === "rop") {
    const ctx = await loadOneCShowroomContext(pool);
    const { rms } = teamContextForUser(userId, ctx);
    ropTeamRmFullNames = rms.map((rm) => rm.full_name);
  }

  return canEditDistributionForStore1cSync(user, names, ropTeamRmFullNames);
}
