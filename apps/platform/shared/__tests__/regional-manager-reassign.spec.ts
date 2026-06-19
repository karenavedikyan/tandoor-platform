import { describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../admin/admin-auth.js";
import { handleRegionalManagerReassign } from "../admin/client-assignments-handlers.js";

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const ROP_ID = "00000000-0000-4000-8000-000000000002";
const RM_ID = "00000000-0000-4000-8000-000000000003";
const OTHER_RM_ID = "00000000-0000-4000-8000-000000000004";
const MANAGER_ID = "00000000-0000-4000-8000-000000000005";
const TEAM_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_TEAM_ID = "10000000-0000-4000-8000-000000000002";

const CODE_A = "MA-MA030001";
const CODE_B = "MA-MA030002";
const CODE_C = "MA-MA030003";
const DEALER_A = "client-ma-ma030001";
const DEALER_B = "client-ma-ma030002";
const TP_1 = "tp-00000001";
const TP_2 = "tp-00000002";
const TP_3 = "tp-00000003";

type MockRes = {
  statusCode: number;
  body: Record<string, unknown> | null;
  setHeader: ReturnType<typeof vi.fn>;
  status(code: number): MockRes;
  json(payload: Record<string, unknown>): MockRes;
};

function mockRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    body: null,
    setHeader: vi.fn(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: Record<string, unknown>) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

function asRes(res: MockRes): VercelResponse {
  return res as unknown as VercelResponse;
}

function mockReq(body: Record<string, unknown>): VercelRequest {
  return { body } as VercelRequest;
}

type DbState = {
  dealerOverrides: Map<string, { regional_manager_id: string | null; regional_manager_name: string | null }>;
  tradePointOverrides: Map<string, { regional_manager_id: string | null; regional_manager_name: string | null }>;
  clientTeams: Map<string, string>;
  dealerHistory: Array<Record<string, unknown>>;
  dealerEvents: Array<Record<string, unknown>>;
  tpEvents: Array<Record<string, unknown>>;
  auditLog: Array<Record<string, unknown>>;
  users: Map<string, { role: string; status: string; full_name: string; email: string }>;
  teamMemberships: Array<{ user_id: string; team_id: string; role_in_team: string }>;
  ropTeams: Map<string, string>;
};

function createPool(state: DbState): PoolLike {
  return {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      const s = sql.replace(/\s+/g, " ").trim();

      if (s.includes("SELECT id FROM teams WHERE rop_user_id")) {
        const ropId = String(params[0]);
        const teamId = state.ropTeams.get(ropId);
        return { rows: teamId ? [{ id: teamId }] : [] };
      }

      if (s.includes("SELECT 1 AS ok FROM users u") && s.includes("regional_manager")) {
        const userId = String(params[0]);
        const u = state.users.get(userId);
        if (!u || u.status !== "active") return { rows: [] };
        const inTeam = state.teamMemberships.some(
          (m) => m.user_id === userId && m.role_in_team === "regional_manager",
        );
        if (u.role === "regional_manager" || inTeam) return { rows: [{ ok: 1 }] };
        return { rows: [] };
      }

      if (s.includes("COALESCE(NULLIF(btrim(full_name)") && s.includes("FROM users WHERE id")) {
        const userId = String(params[0]);
        const u = state.users.get(userId);
        if (!u || u.status !== "active") return { rows: [] };
        const display = u.full_name.trim() || u.email.trim();
        return { rows: [{ display_name: display || null }] };
      }

      if (s.includes("role_in_team = 'regional_manager'") && s.includes("user_team_memberships")) {
        const [userId, teamId] = params as string[];
        const ok = state.teamMemberships.some(
          (m) => m.user_id === userId && m.team_id === teamId && m.role_in_team === "regional_manager",
        );
        return { rows: ok ? [{ ok: 1 }] : [] };
      }

      if (s.startsWith("SELECT ca.client_code") && s.includes("FROM client_assignments ca")) {
        const codes: string[] = [];
        if (s.includes("ca.client_code = ANY")) {
          const filterCodes = params.find(
            (p) => Array.isArray(p) && (p as string[]).some((c) => [CODE_A, CODE_B, CODE_C].includes(c)),
          ) as string[] | undefined;
          if (filterCodes) {
            for (const c of filterCodes) {
              if (state.clientTeams.has(c)) codes.push(c);
            }
          }
        }
        if (s.includes("EXISTS") && s.includes("trade_points tp")) {
          const tpIds = params.find((p) => Array.isArray(p) && (p as string[]).includes(TP_1)) as string[] | undefined;
          if (tpIds?.includes(TP_1)) codes.push(CODE_A);
          if (tpIds?.includes(TP_2)) codes.push(CODE_A);
        }
        if (s.includes("ca.responsible_user_id = ANY")) {
          codes.push(CODE_A, CODE_B);
        }
        if (s.includes("ca.team_id =") && !s.includes("ANY")) {
          const teamId = String(params[params.length - 1]);
          return {
            rows: [...state.clientTeams.entries()]
              .filter(([, t]) => t === teamId)
              .map(([code]) => ({ client_code: code })),
          };
        }
        return { rows: [...new Set(codes)].map((client_code) => ({ client_code })) };
      }

      if (s.includes("COUNT(*)::int AS n FROM client_assignments WHERE client_code = ANY")) {
        const [codes, teamId] = params as [string[], string];
        const n = codes.filter((c) => state.clientTeams.get(c) !== teamId).length;
        return { rows: [{ n }] };
      }

      if (s.includes("COUNT(*)::int AS n") && s.includes("trade_points tp")) {
        const [tpIds, teamId] = params as [string[], string];
        let n = 0;
        for (const tpId of tpIds) {
          const code = tpId === TP_3 ? CODE_C : CODE_A;
          if (state.clientTeams.get(code) !== teamId) n += 1;
        }
        return { rows: [{ n }] };
      }

      if (s.includes("FROM unnest($1::text[]) AS code") && s.includes("LEFT JOIN dealer_overrides")) {
        const codes = params[0] as string[];
        return {
          rows: codes.map((code) => ({
            dealer_id: `client-${code.toLowerCase().replace(/^ma-/, "ma-")}`,
            from_user_id: state.dealerOverrides.get(`client-${code.toLowerCase().replace(/^ma-/, "ma-")}`)?.regional_manager_id ?? null,
          })),
        };
      }

      if (s.startsWith("INSERT INTO dealer_overrides")) {
        const [codes, toUserId, rmName, actorId] = params as [string[], string | null, string | null, string];
        const rows: { dealer_id: string }[] = [];
        for (const code of codes) {
          const dealerId = `client-${code.toLowerCase()}`;
          state.dealerOverrides.set(dealerId, {
            regional_manager_id: toUserId,
            regional_manager_name: rmName,
          });
          rows.push({ dealer_id: dealerId });
        }
        void actorId;
        return { rows };
      }

      if (s.includes("INSERT INTO dealer_responsibility_history")) {
        state.dealerHistory.push({
          dealer_id: params[0],
          from_user_id: params[1],
          to_user_id: params[2],
          actor_user_id: params[3],
          reason: params[4],
        });
        return { rows: [] };
      }

      if (s.includes("INSERT INTO dealer_override_events")) {
        state.dealerEvents.push({ dealer_id: params[0], event_kind: params[3] });
        return { rows: [] };
      }

      if (s.startsWith("SELECT tp.id::text AS tp_id")) {
        const codes = params[0] as string[];
        const rows: { tp_id: string }[] = [];
        if (codes.includes(CODE_A)) rows.push({ tp_id: TP_1 }, { tp_id: TP_2 });
        return { rows };
      }

      if (s.startsWith("INSERT INTO trade_point_overrides")) {
        const [tpIds, toUserId, rmName] = params as [string[], string | null, string | null];
        const rows: { tp_id: string }[] = [];
        for (const tpId of tpIds) {
          state.tradePointOverrides.set(tpId, {
            regional_manager_id: toUserId,
            regional_manager_name: rmName,
          });
          rows.push({ tp_id: tpId });
        }
        return { rows };
      }

      if (s.includes("INSERT INTO trade_point_override_events")) {
        state.tpEvents.push({ tp_id: params[0], event_kind: params[3] });
        return { rows: [] };
      }

      if (s.includes("INSERT INTO audit_log")) {
        state.auditLog.push({ action: params[1], metadata: params[4] });
        return { rows: [] };
      }

      return { rows: [] };
    }) as PoolLike["query"],
  };
}

function baseState(): DbState {
  return {
    dealerOverrides: new Map([
      [DEALER_A, { regional_manager_id: OTHER_RM_ID, regional_manager_name: "Old RM" }],
      [DEALER_B, { regional_manager_id: null, regional_manager_name: null }],
    ]),
    tradePointOverrides: new Map([
      [TP_1, { regional_manager_id: OTHER_RM_ID, regional_manager_name: "Old RM" }],
      [TP_2, { regional_manager_id: OTHER_RM_ID, regional_manager_name: "Old RM" }],
      [TP_3, { regional_manager_id: OTHER_RM_ID, regional_manager_name: "Old RM" }],
    ]),
    clientTeams: new Map([
      [CODE_A, TEAM_ID],
      [CODE_B, TEAM_ID],
      [CODE_C, OTHER_TEAM_ID],
    ]),
    dealerHistory: [],
    dealerEvents: [],
    tpEvents: [],
    auditLog: [],
    users: new Map([
      [ADMIN_ID, { role: "admin", status: "active", full_name: "Admin", email: "admin@test" }],
      [ROP_ID, { role: "rop", status: "active", full_name: "ROP", email: "rop@test" }],
      [RM_ID, { role: "regional_manager", status: "active", full_name: "Мельник Виктор Викторович", email: "rm@test" }],
      [OTHER_RM_ID, { role: "regional_manager", status: "active", full_name: "Other RM", email: "orm@test" }],
      [MANAGER_ID, { role: "manager", status: "active", full_name: "Manager", email: "mgr@test" }],
    ]),
    teamMemberships: [{ user_id: RM_ID, team_id: TEAM_ID, role_in_team: "regional_manager" }],
    ropTeams: new Map([[ROP_ID, TEAM_ID]]),
  };
}

describe("handleRegionalManagerReassign", () => {
  it("admin assigns RM to 3 clients with cascade updates trade points", async () => {
    const state = baseState();
    const pool = createPool(state);
    const res = mockRes();
    await handleRegionalManagerReassign(
      mockReq({
        toUserId: RM_ID,
        clientCodes: [CODE_A, CODE_B, CODE_C],
        cascadeTradePoints: true,
      }),
      asRes(res),
      pool,
      { id: ADMIN_ID, role: "admin", status: "active" },
    );
    expect(res.statusCode).toBe(200);
    expect(res.body?.dealersAffected).toBe(3);
    expect(res.body?.tradePointsAffected).toBe(2);
    expect(state.dealerOverrides.get(DEALER_A)?.regional_manager_name).toBe("Мельник Виктор Викторович");
    expect(state.tradePointOverrides.get(TP_1)?.regional_manager_id).toBe(RM_ID);
    expect(state.tradePointOverrides.get(TP_2)?.regional_manager_id).toBe(RM_ID);
    expect(state.dealerHistory).toHaveLength(3);
    expect(state.tpEvents.length).toBeGreaterThanOrEqual(2);
  });

  it("toUserId null clears dealer and cascaded trade points", async () => {
    const state = baseState();
    const pool = createPool(state);
    const res = mockRes();
    await handleRegionalManagerReassign(
      mockReq({ toUserId: null, clientCodes: [CODE_A], cascadeTradePoints: true }),
      asRes(res),
      pool,
      { id: ADMIN_ID, role: "admin", status: "active" },
    );
    expect(res.statusCode).toBe(200);
    expect(state.dealerOverrides.get(DEALER_A)?.regional_manager_id).toBeNull();
    expect(state.tradePointOverrides.get(TP_1)?.regional_manager_id).toBeNull();
    expect(state.tradePointOverrides.get(TP_2)?.regional_manager_id).toBeNull();
  });

  it("tradePointIds only updates selected trade points", async () => {
    const state = baseState();
    const pool = createPool(state);
    const res = mockRes();
    await handleRegionalManagerReassign(
      mockReq({ toUserId: RM_ID, tradePointIds: [TP_1], cascadeTradePoints: false }),
      asRes(res),
      pool,
      { id: ADMIN_ID, role: "admin", status: "active" },
    );
    expect(res.statusCode).toBe(200);
    expect(res.body?.dealersAffected).toBe(0);
    expect(res.body?.tradePointsAffected).toBe(1);
    expect(state.tradePointOverrides.get(TP_1)?.regional_manager_id).toBe(RM_ID);
    expect(state.tradePointOverrides.get(TP_2)?.regional_manager_id).toBe(OTHER_RM_ID);
  });

  it("filter.tradePointIds narrows dealers from filter query", async () => {
    const state = baseState();
    const pool = createPool(state);
    const res = mockRes();
    await handleRegionalManagerReassign(
      mockReq({
        toUserId: RM_ID,
        filter: { tradePointIds: [TP_1] },
        cascadeTradePoints: false,
      }),
      asRes(res),
      pool,
      { id: ADMIN_ID, role: "admin", status: "active" },
    );
    expect(res.statusCode).toBe(200);
    expect(res.body?.dealersAffected).toBe(1);
  });

  it("filter.clientCodes works", async () => {
    const state = baseState();
    const pool = createPool(state);
    const res = mockRes();
    await handleRegionalManagerReassign(
      mockReq({
        toUserId: RM_ID,
        filter: { clientCodes: [CODE_B] },
        cascadeTradePoints: false,
      }),
      asRes(res),
      pool,
      { id: ADMIN_ID, role: "admin", status: "active" },
    );
    expect(res.statusCode).toBe(200);
    expect(res.body?.dealersAffected).toBe(1);
  });

  it("ROP can assign only team regional manager", async () => {
    const state = baseState();
    const pool = createPool(state);
    const res = mockRes();
    await handleRegionalManagerReassign(
      mockReq({ toUserId: RM_ID, clientCodes: [CODE_A], cascadeTradePoints: false }),
      asRes(res),
      pool,
      { id: ROP_ID, role: "rop", status: "active" },
    );
    expect(res.statusCode).toBe(200);
  });

  it("ROP cannot assign regional manager from another team", async () => {
    const state = baseState();
    state.teamMemberships = [];
    const pool = createPool(state);
    const res = mockRes();
    await handleRegionalManagerReassign(
      mockReq({ toUserId: RM_ID, clientCodes: [CODE_A], cascadeTradePoints: false }),
      asRes(res),
      pool,
      { id: ROP_ID, role: "rop", status: "active" },
    );
    expect(res.statusCode).toBe(403);
  });

  it("ROP cannot touch client from another team", async () => {
    const state = baseState();
    const pool = createPool(state);
    const res = mockRes();
    await handleRegionalManagerReassign(
      mockReq({ toUserId: RM_ID, clientCodes: [CODE_C], cascadeTradePoints: false }),
      asRes(res),
      pool,
      { id: ROP_ID, role: "rop", status: "active" },
    );
    expect(res.statusCode).toBe(403);
  });

  it("ROP cannot touch trade point from another team", async () => {
    const state = baseState();
    const pool = createPool(state);
    const res = mockRes();
    await handleRegionalManagerReassign(
      mockReq({ toUserId: RM_ID, tradePointIds: [TP_3], cascadeTradePoints: false }),
      asRes(res),
      pool,
      { id: ROP_ID, role: "rop", status: "active" },
    );
    expect(res.statusCode).toBe(403);
  });

  it("manager gets 403", async () => {
    const state = baseState();
    const pool = createPool(state);
    const res = mockRes();
    await handleRegionalManagerReassign(
      mockReq({ toUserId: RM_ID, clientCodes: [CODE_A] }),
      asRes(res),
      pool,
      { id: MANAGER_ID, role: "manager", status: "active" },
    );
    expect(res.statusCode).toBe(403);
  });

  it("writes dealer_responsibility_history per dealer", async () => {
    const state = baseState();
    const pool = createPool(state);
    const res = mockRes();
    await handleRegionalManagerReassign(
      mockReq({ toUserId: RM_ID, clientCodes: [CODE_A, CODE_B], cascadeTradePoints: false }),
      asRes(res),
      pool,
      { id: ADMIN_ID, role: "admin", status: "active" },
    );
    expect(state.dealerHistory).toHaveLength(2);
    expect(state.dealerEvents).toHaveLength(2);
  });
});

describe("dealer_responsibility_history migration hotfix", () => {
  it("replaces UUID regional_manager_name with user full_name", async () => {
    const sql = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL("../../server/migrations/2026_06_21_dealer_responsibility_history.sql", import.meta.url),
        "utf8",
      ),
    );
    expect(sql).toContain("dealer_responsibility_history");
    expect(sql).toContain("FROM users WHERE id = dealer_overrides.regional_manager_id");
    expect(sql).toContain("regional_manager_name ~*");
  });
});
