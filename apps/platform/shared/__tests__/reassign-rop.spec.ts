/**
 * Явное переназначение РОПа клиентам (reassign-rop).
 *
 * Запуск: `npm run test:reassign-rop`
 */
import { describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../admin/admin-auth.js";
import {
  applyRopToClients,
  handleRopReassign,
} from "../admin/client-assignments-handlers.js";

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const ROP_X_ID = "00000000-0000-4000-8000-000000000010";
const ROP_Y_ID = "00000000-0000-4000-8000-000000000011";
const INACTIVE_ROP_ID = "00000000-0000-4000-8000-000000000012";
const TEAM_X = "10000000-0000-4000-8000-000000000001";

const CODE_A = "MA-MA085529";
const DEALER_A_CLIENT = "client-ma-ma085529";

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

type DealerOverrideRow = {
  dealer_id: string;
  rop_id: string | null;
  rop_name: string | null;
};

type AssignmentRow = {
  client_code: string;
  responsible_user_id: string;
  team_id: string;
};

type DbState = {
  assignments: Map<string, AssignmentRow>;
  dealerOverrides: Map<string, DealerOverrideRow>;
  dealers: Map<string, { release_code: string; external_key: string; id: string }>;
  users: Map<string, { full_name: string; status: string; role: string }>;
  queryLog: string[];
  auditLog: Array<Record<string, unknown>>;
};

function createPool(state: DbState): PoolLike {
  return {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      const s = sql.replace(/\s+/g, " ").trim();
      state.queryLog.push(s);

      if (s.includes("SELECT id FROM teams WHERE rop_user_id")) {
        if (String(params[0]) === ROP_X_ID) return { rows: [{ id: TEAM_X }] };
        return { rows: [] };
      }

      if (s.includes("FROM users u") && s.includes("u.role = 'rop'") && s.includes("u.id = $1")) {
        const userId = String(params[0]);
        const user = state.users.get(userId);
        if (!user || user.role !== "rop" || user.status !== "active") return { rows: [] };
        return { rows: [{ rop_user_id: userId, full_name: user.full_name }] };
      }

      if (s.includes("SELECT 1 FROM users WHERE id = $1::uuid AND role = 'rop'")) {
        const userId = String(params[0]);
        const user = state.users.get(userId);
        if (user?.role === "rop" && user.status === "active") return { rows: [{ ok: 1 }] };
        return { rows: [] };
      }

      if (s.includes("COUNT(*)::int AS n FROM client_assignments WHERE client_code = ANY")) {
        const [codes, teamId] = params as [string[], string];
        const n = codes.filter((c) => state.assignments.get(c)?.team_id !== teamId).length;
        return { rows: [{ n }] };
      }

      if (s.startsWith("INSERT INTO dealer_overrides (dealer_id, rop_id, rop_name")) {
        const [codes, ropId, ropName] = params as [string[], string, string | null];
        let count = 0;
        for (const code of codes) {
          const dealer = state.dealers.get(code);
          let dealerId: string | undefined;
          for (const id of Array.from(state.dealerOverrides.keys())) {
            if (dealer && (id === dealer.id || id === dealer.external_key)) {
              dealerId = id;
              break;
            }
          }
          dealerId = dealerId ?? dealer?.external_key ?? `client-${code.toLowerCase()}`;
          state.dealerOverrides.set(dealerId, {
            dealer_id: dealerId,
            rop_id: ropId,
            rop_name: ropName,
          });
          count += 1;
        }
        return { rows: [], rowCount: count };
      }

      if (s.startsWith("SELECT ca.client_code") && s.includes("FROM client_assignments ca")) {
        return { rows: [] };
      }

      if (s.includes("INSERT INTO audit_log")) {
        state.auditLog.push({ action: params[1] });
        return { rows: [] };
      }

      return { rows: [] };
    }) as PoolLike["query"],
  };
}

function baseState(): DbState {
  return {
    assignments: new Map([
      [CODE_A, { client_code: CODE_A, responsible_user_id: "mgr-1", team_id: TEAM_X }],
    ]),
    dealerOverrides: new Map([
      [DEALER_A_CLIENT, { dealer_id: DEALER_A_CLIENT, rop_id: ROP_X_ID, rop_name: "ROP X" }],
    ]),
    dealers: new Map([
      [CODE_A, { release_code: CODE_A, external_key: DEALER_A_CLIENT, id: "d-uuid-a" }],
    ]),
    users: new Map([
      [ROP_X_ID, { full_name: "Скалабан Александр", status: "active", role: "rop" }],
      [ROP_Y_ID, { full_name: "Купянский Родион", status: "active", role: "rop" }],
      [INACTIVE_ROP_ID, { full_name: "Inactive ROP", status: "inactive", role: "rop" }],
    ]),
    queryLog: [],
    auditLog: [],
  };
}

describe("applyRopToClients", () => {
  it("writes rop_id and rop_name for given codes", async () => {
    const state = baseState();
    const pool = createPool(state);
    const affected = await applyRopToClients(pool, [CODE_A], ROP_Y_ID);
    expect(affected).toBe(1);
    expect(state.dealerOverrides.get(DEALER_A_CLIENT)?.rop_id).toBe(ROP_Y_ID);
    expect(state.dealerOverrides.get(DEALER_A_CLIENT)?.rop_name).toBe("Купянский Родион");
  });

  it("returns 0 and does not write when ROP is inactive or missing", async () => {
    const state = baseState();
    const pool = createPool(state);
    const before = state.dealerOverrides.get(DEALER_A_CLIENT)?.rop_id;
    expect(await applyRopToClients(pool, [CODE_A], INACTIVE_ROP_ID)).toBe(0);
    expect(await applyRopToClients(pool, [CODE_A], "00000000-0000-4000-8999-000000000099")).toBe(0);
    expect(state.dealerOverrides.get(DEALER_A_CLIENT)?.rop_id).toBe(before);
    expect(state.queryLog.some((q) => q.startsWith("INSERT INTO dealer_overrides (dealer_id, rop_id, rop_name"))).toBe(
      false,
    );
  });

  it("overwrites existing non-empty rop_id", async () => {
    const state = baseState();
    const pool = createPool(state);
    await applyRopToClients(pool, [CODE_A], ROP_Y_ID);
    expect(state.dealerOverrides.get(DEALER_A_CLIENT)?.rop_id).toBe(ROP_Y_ID);
  });

  it("does not touch client_assignments", async () => {
    const state = baseState();
    const pool = createPool(state);
    const assignmentBefore = { ...state.assignments.get(CODE_A)! };
    await applyRopToClients(pool, [CODE_A], ROP_Y_ID);
    expect(state.assignments.get(CODE_A)).toEqual(assignmentBefore);
    expect(state.queryLog.some((q) => q.startsWith("UPDATE client_assignments"))).toBe(false);
    expect(state.queryLog.some((q) => q.includes("client_assignment_history"))).toBe(false);
  });
});

describe("handleRopReassign", () => {
  it("admin can assign any ROP", async () => {
    const state = baseState();
    const pool = createPool(state);
    const res = mockRes();
    await handleRopReassign(
      mockReq({ ropUserId: ROP_Y_ID, clientCodes: [CODE_A] }),
      asRes(res),
      pool,
      { id: ADMIN_ID, role: "admin", status: "active" },
    );
    expect(res.statusCode).toBe(200);
    expect(res.body?.affected).toBe(1);
    expect(state.dealerOverrides.get(DEALER_A_CLIENT)?.rop_id).toBe(ROP_Y_ID);
    expect(state.auditLog.some((a) => a.action === "client.reassign-rop")).toBe(true);
  });

  it("rop can assign only to self", async () => {
    const state = baseState();
    const pool = createPool(state);
    const res = mockRes();
    await handleRopReassign(
      mockReq({ ropUserId: ROP_Y_ID, clientCodes: [CODE_A] }),
      asRes(res),
      pool,
      { id: ROP_X_ID, role: "rop", status: "active" },
    );
    expect(res.statusCode).toBe(403);
    expect(state.dealerOverrides.get(DEALER_A_CLIENT)?.rop_id).toBe(ROP_X_ID);
  });

  it("rejects invalid ropUserId", async () => {
    const state = baseState();
    const pool = createPool(state);
    const res = mockRes();
    await handleRopReassign(
      mockReq({ ropUserId: "not-a-uuid", clientCodes: [CODE_A] }),
      asRes(res),
      pool,
      { id: ADMIN_ID, role: "admin", status: "active" },
    );
    expect(res.statusCode).toBe(400);
  });

  it("rejects inactive or non-ROP target", async () => {
    const state = baseState();
    const pool = createPool(state);
    const res = mockRes();
    await handleRopReassign(
      mockReq({ ropUserId: INACTIVE_ROP_ID, clientCodes: [CODE_A] }),
      asRes(res),
      pool,
      { id: ADMIN_ID, role: "admin", status: "active" },
    );
    expect(res.statusCode).toBe(400);
  });

  it("returns affected 0 when filter resolves to no clients", async () => {
    const state = baseState();
    const pool = createPool(state);
    const res = mockRes();
    await handleRopReassign(
      mockReq({ ropUserId: ROP_Y_ID, filter: { city: ["Город без клиентов"] } }),
      asRes(res),
      pool,
      { id: ADMIN_ID, role: "admin", status: "active" },
    );
    expect(res.statusCode).toBe(200);
    expect(res.body?.affected).toBe(0);
    expect(state.dealerOverrides.get(DEALER_A_CLIENT)?.rop_id).toBe(ROP_X_ID);
  });
});
