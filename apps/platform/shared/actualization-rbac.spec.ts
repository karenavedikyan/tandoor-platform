/**
 * Промт 398: серверный RBAC на unTrash.
 */
import { describe, expect, it } from "vitest";
import type { PoolLike } from "./admin/admin-auth.js";
import { assertUnTrashAllowed } from "./trash-archive-mutation-guard.js";

function mockPool(teamId: string | null, memberIds: string[]): PoolLike {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.includes("FROM teams WHERE rop_user_id")) {
        return { rows: teamId ? [{ id: teamId }] : [] };
      }
      if (s.includes("FROM user_team_memberships")) {
        if (s.includes("team_id = $1")) {
          return { rows: memberIds.map((id) => ({ id })) };
        }
        return { rows: teamId ? [{ team_id: teamId }] : [] };
      }
      if (s.includes("FROM client_assignments")) {
        return { rows: [] };
      }
      if (s.includes("FROM dealer_overrides")) {
        return { rows: [] };
      }
      if (s.includes("FROM rop_client_grants")) {
        return { rows: [] };
      }
      void params;
      return { rows: [] };
    },
  };
}

describe("actualization-rbac", () => {
  it("manager cannot restore foreign trash", async () => {
    const pool = mockPool("team-a", ["mgr-a"]);
    const prev = {
      trashedDealersById: {
        "client-x": { trashedBy: "mgr-b", ownerTeamAtTrash: "team-a" },
      },
    };
    const r = await assertUnTrashAllowed(
      pool,
      { id: "mgr-a", role: "manager" },
      prev,
      { dealers: ["client-x"] },
    );
    expect(r.ok).toBe(false);
  });

  it("rop can restore team member trash", async () => {
    const pool = mockPool("team-a", ["mgr-a", "rop-1"]);
    const prev = {
      trashedDealersById: {
        "client-x": { trashedBy: "mgr-a", ownerTeamAtTrash: "team-a" },
      },
    };
    const r = await assertUnTrashAllowed(
      pool,
      { id: "rop-1", role: "rop" },
      prev,
      { dealers: ["client-x"] },
    );
    expect(r.ok).toBe(true);
  });
});
