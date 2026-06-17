/**
 * Промт 390 — RBAC в /api/users/picker.
 * Покрываем фильтрацию по canViewerAccessUserScope для ролей rop и regional_manager.
 *
 * Запуск: `npm run test:users-picker-rbac` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import { canViewerAccessUserScope } from "../scope-for-user-access.js";
import type { PoolLike } from "../responsibility-resolver.js";

function makePoolWithMembership(memberships: Array<{ user_id: string; team_id: string; rop_user_id: string }>): PoolLike {
  return {
    async query(sql: string, params?: unknown[]) {
      const targetId = params?.[1] as string;
      const sqlText = sql.toString();
      let count = 0;
      if (sqlText.includes("t.rop_user_id = $1")) {
        const viewerId = params?.[0] as string;
        count = memberships.filter(
          (m) => m.user_id === targetId && m.rop_user_id === viewerId,
        ).length;
      } else if (sqlText.includes("viewer_m.user_id = $1")) {
        const viewerId = params?.[0] as string;
        const viewerTeams = memberships.filter((m) => m.user_id === viewerId).map((m) => m.team_id);
        count = memberships.filter(
          (m) => m.user_id === targetId && viewerTeams.includes(m.team_id),
        ).length;
      }
      return { rows: [{ c: String(count) }] };
    },
  };
}

const ROP_A = "11111111-1111-1111-1111-111111111111";
const ROP_B = "22222222-2222-2222-2222-222222222222";
const MANAGER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const MANAGER_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const TEAM_A = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const TEAM_B = "dddddddd-dddd-dddd-dddd-dddddddddddd";

const memberships = [
  { user_id: MANAGER_A, team_id: TEAM_A, rop_user_id: ROP_A },
  { user_id: MANAGER_B, team_id: TEAM_B, rop_user_id: ROP_B },
];

{
  const pool = makePoolWithMembership(memberships);
  assert.equal(await canViewerAccessUserScope(pool, ROP_A, "rop", MANAGER_A), true);
}

{
  const pool = makePoolWithMembership(memberships);
  assert.equal(await canViewerAccessUserScope(pool, ROP_A, "rop", MANAGER_B), false);
}

{
  const pool = makePoolWithMembership(memberships);
  assert.equal(await canViewerAccessUserScope(pool, ROP_A, "admin", MANAGER_B), true);
  assert.equal(await canViewerAccessUserScope(pool, ROP_A, "director", MANAGER_B), true);
}

{
  const pool = makePoolWithMembership(memberships);
  assert.equal(await canViewerAccessUserScope(pool, MANAGER_A, "manager", MANAGER_B), false);
}

console.log("users-picker-rbac.test.ts: ok");
