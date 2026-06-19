/**
 * Промт 427: RM scope только из dealer_overrides.regional_manager_id, без teamCodes.
 *
 * Запуск: `npx vitest run shared/__tests__/db-scope-formula-rm.spec.ts`
 */
import { describe, expect, it } from "vitest";
import type { PoolLike } from "../responsibility-resolver.js";
import { computeDbScopeForUser, resolveScopeCodesMeta } from "../db-scope-formula.js";

const RM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ROP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TEAM_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const ROP_TEAM_CODES = ["ROP001", "ROP002", "ROP003", "ROP004", "ROP005", "ROP006", "ROP007", "ROP008", "ROP009", "ROP010"];
const RM_OWN_CODES = ["RM001", "RM002", "RM003"];
/** Пересечение: дилер есть и у RM в dealer_overrides, и у РОПа в client_assignments. */
const OVERLAP_CODE = "RM002";

type DealerRow = {
  id: string;
  external_key: string;
  release_code: string;
  trashed: boolean;
  trashed_by: string | null;
};

const DEALERS: DealerRow[] = [
  ...RM_OWN_CODES.map((code, i) => ({
    id: `d-rm-${i}`,
    external_key: `client-${code.toLowerCase()}`,
    release_code: code,
    trashed: false,
    trashed_by: null,
  })),
  ...ROP_TEAM_CODES.filter((c) => c !== OVERLAP_CODE).map((code, i) => ({
    id: `d-rop-${i}`,
    external_key: `client-${code.toLowerCase()}`,
    release_code: code,
    trashed: false,
    trashed_by: null,
  })),
];

function makePool(): PoolLike {
  return {
    query: async (sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, " ").trim();

      if (s.includes("FROM user_team_memberships WHERE user_id") && !s.includes("team_id IN")) {
        const userId = params?.[0] as string;
        if (userId === RM_ID) return { rows: [{ team_id: TEAM_ID }] };
        return { rows: [] };
      }

      if (s.includes("FROM teams t") && s.includes("rop_user_id")) {
        return { rows: [{ team_id: TEAM_ID }] };
      }

      if (s.includes("FROM user_team_memberships") && s.includes("team_id IN")) {
        return { rows: [{ user_id: ROP_ID }] };
      }

      if (s.includes("dealer_overrides") && s.includes("regional_manager_id")) {
        const userId = params?.[0] as string;
        if (userId !== RM_ID) return { rows: [] };
        return {
          rows: RM_OWN_CODES.map((code) => ({ client_code: code })),
        };
      }

      if (s.includes("client_assignments WHERE responsible_user_id")) {
        const userId = params?.[0] as string;
        if (userId === ROP_ID) {
          return { rows: ROP_TEAM_CODES.map((client_code) => ({ client_code })) };
        }
        return { rows: [] };
      }

      if (s.includes("client_assignments ca") && s.includes("team_id = ANY")) {
        return { rows: ROP_TEAM_CODES.map((client_code) => ({ client_code })) };
      }

      if (s.includes("rop_client_grants")) {
        return { rows: [] };
      }

      if (s.includes("FROM dealers d") && s.includes("release_code = ANY")) {
        const codes = (params?.[0] as string[]) ?? [];
        const rows = DEALERS.filter((d) => codes.includes(d.release_code)).map((d) => ({
          id: d.id,
          external_key: d.external_key,
          status: d.trashed ? "in_trash" : "active",
          trashed_by: d.trashed_by,
        }));
        return { rows };
      }

      if (s.includes("FROM dealer_overrides d_ov") && s.includes("status = 'pending_admin'")) {
        return { rows: [{ n: "0" }] };
      }
      if (s.includes("FROM trade_point_overrides tpo") && s.includes("status = 'pending_admin'")) {
        return { rows: [{ n: "0" }] };
      }

      if (s.includes("FROM trade_points tp") && s.includes("dealer_id = ANY")) {
        return { rows: [{ active_tps: "0", trashed_tps: "0" }] };
      }

      void params;
      return { rows: [] };
    },
  };
}

describe("db-scope-formula regional_manager (prompt 427)", () => {
  it("uses dealer_overrides for ownCodes, empty teamCodes", async () => {
    const pool = makePool();
    const meta = await resolveScopeCodesMeta(pool, RM_ID, "regional_manager");

    expect(meta.ownCodes).toEqual(RM_OWN_CODES);
    expect(meta.teamCodes).toEqual([]);
    expect(meta.grantedCodes).toEqual([]);
    expect(meta.allCodes).toEqual(RM_OWN_CODES);
    expect(meta.fullCatalog).toBe(false);
  });

  it("computeDbScopeForUser returns only RM dealers, not ROP team", async () => {
    const pool = makePool();
    const scope = await computeDbScopeForUser(pool, RM_ID, "regional_manager");

    expect(scope.totals.active_dealers).toBe(3);
    expect(scope.scope_explanation.own_codes).toBe(3);
    expect(scope.scope_explanation.team_codes).toBe(0);
    expect(scope.scope_explanation.all_codes).toBe(3);
    expect(scope.active_dealer_external_keys).toHaveLength(3);
    for (const code of ROP_TEAM_CODES) {
      if (code === OVERLAP_CODE) continue;
      expect(scope.active_dealer_external_keys.some((k) => k.includes(code.toLowerCase()))).toBe(false);
    }
  });

  it("deduplicates overlap between RM ownCodes and ROP teamCodes", async () => {
    const pool = makePool();
    const meta = await resolveScopeCodesMeta(pool, RM_ID, "regional_manager");

    expect(meta.allCodes.filter((c) => c === OVERLAP_CODE)).toEqual([OVERLAP_CODE]);
    expect(meta.allCodes).toHaveLength(3);
  });

  it("does not change rop teamCodes behavior", async () => {
    const pool = makePool();
    const meta = await resolveScopeCodesMeta(pool, ROP_ID, "rop");

    expect(meta.teamCodes.length).toBe(ROP_TEAM_CODES.length);
    expect(meta.ownCodes.length).toBeGreaterThan(0);
    expect(meta.allCodes.length).toBeGreaterThanOrEqual(ROP_TEAM_CODES.length);
  });
});
