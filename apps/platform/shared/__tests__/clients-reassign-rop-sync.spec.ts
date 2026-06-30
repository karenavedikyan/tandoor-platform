/**
 * Синхронизация dealer_overrides.rop_id при переназначении клиентов.
 *
 * Запуск: `npx vitest run shared/__tests__/clients-reassign-rop-sync.spec.ts`
 */
import { describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../admin/admin-auth.js";
import {
  handleClientsReassign,
  syncRopIdForReassignedClients,
} from "../admin/client-assignments-handlers.js";

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const ROP_X_ID = "00000000-0000-4000-8000-000000000010";
const ROP_Y_ID = "00000000-0000-4000-8000-000000000011";
const MANAGER_A = "00000000-0000-4000-8000-000000000020";
const MANAGER_B = "00000000-0000-4000-8000-000000000021";
const TEAM_X = "10000000-0000-4000-8000-000000000001";
const TEAM_Y = "10000000-0000-4000-8000-000000000002";
const TEAM_NO_ROP = "10000000-0000-4000-8000-000000000003";

const CODE_A = "MA-MA085529";
const CODE_B = "MA-MA085530";
const DEALER_A_CLIENT = "client-ma-ma085529";
const DEALER_A_UUID = "d0000000-0000-4000-8000-0000000000aa";

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
  teams: Map<string, { rop_user_id: string | null }>;
  users: Map<string, { full_name: string; status: string }>;
  memberships: Map<string, string>;
  history: Array<Record<string, unknown>>;
  auditLog: Array<Record<string, unknown>>;
};

function createPool(state: DbState): PoolLike {
  return {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      const s = sql.replace(/\s+/g, " ").trim();

      if (s.includes("SELECT team_id FROM user_team_memberships WHERE user_id")) {
        const userId = String(params[0]);
        const teamId = state.memberships.get(userId);
        return { rows: teamId ? [{ team_id: teamId }] : [] };
      }

      if (s.includes("SELECT id FROM teams WHERE rop_user_id")) {
        for (const [teamId, team] of Array.from(state.teams.entries())) {
          if (team.rop_user_id === String(params[0])) return { rows: [{ id: teamId }] };
        }
        return { rows: [] };
      }

      if (s.includes("SELECT 1 FROM user_team_memberships WHERE user_id")) {
        const [userId, teamId] = params as string[];
        return { rows: state.memberships.get(userId) === teamId ? [{ ok: 1 }] : [] };
      }

      if (s.includes("COUNT(*)::int AS n FROM client_assignments WHERE client_code = ANY")) {
        const [codes, teamId] = params as [string[], string];
        const n = codes.filter((c) => state.assignments.get(c)?.team_id !== teamId).length;
        return { rows: [{ n }] };
      }

      if (s.startsWith("UPDATE client_assignments AS ca")) {
        const [codes, toUserId, newTeamId] = params as [string[], string, string];
        const rows: Array<{
          client_code: string;
          from_uid: string;
          from_tid: string;
          to_uid: string;
          to_tid: string;
        }> = [];
        for (const code of codes) {
          const prev = state.assignments.get(code);
          if (!prev) continue;
          const from_uid = prev.responsible_user_id;
          const from_tid = prev.team_id;
          state.assignments.set(code, {
            client_code: code,
            responsible_user_id: toUserId,
            team_id: newTeamId,
          });
          rows.push({
            client_code: code,
            from_uid,
            from_tid,
            to_uid: toUserId,
            to_tid: newTeamId,
          });
        }
        return { rows };
      }

      if (s.includes("SELECT t.rop_user_id::text") && s.includes("WHERE t.id = $1::uuid")) {
        const teamId = String(params[0]);
        const team = state.teams.get(teamId);
        if (!team?.rop_user_id) return { rows: [] };
        const user = state.users.get(team.rop_user_id);
        return {
          rows: [{ rop_user_id: team.rop_user_id, full_name: user?.full_name ?? null }],
        };
      }

      if (s.startsWith("INSERT INTO dealer_overrides (dealer_id, rop_id, rop_name")) {
        const [codes, ropId, ropName] = params as [string[], string, string | null];
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
        }
        return { rows: [] };
      }

      if (s.includes("INSERT INTO client_assignment_history")) {
        state.history.push({
          client_code: params[0],
          from_user_id: params[1],
          to_user_id: params[2],
        });
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
      [
        CODE_A,
        { client_code: CODE_A, responsible_user_id: MANAGER_A, team_id: TEAM_X },
      ],
      [
        CODE_B,
        { client_code: CODE_B, responsible_user_id: MANAGER_A, team_id: TEAM_X },
      ],
    ]),
    dealerOverrides: new Map([
      [DEALER_A_CLIENT, { dealer_id: DEALER_A_CLIENT, rop_id: ROP_X_ID, rop_name: "ROP X" }],
    ]),
    dealers: new Map([
      [
        CODE_A,
        { release_code: CODE_A, external_key: DEALER_A_CLIENT, id: DEALER_A_UUID },
      ],
      [
        CODE_B,
        { release_code: CODE_B, external_key: "client-ma-ma085530", id: "d0000000-0000-4000-8000-0000000000bb" },
      ],
    ]),
    teams: new Map([
      [TEAM_X, { rop_user_id: ROP_X_ID }],
      [TEAM_Y, { rop_user_id: ROP_Y_ID }],
      [TEAM_NO_ROP, { rop_user_id: null }],
    ]),
    users: new Map([
      [ROP_X_ID, { full_name: "Скалабан Александр", status: "active" }],
      [ROP_Y_ID, { full_name: "Купянский Родион", status: "active" }],
    ]),
    memberships: new Map([
      [MANAGER_A, TEAM_X],
      [MANAGER_B, TEAM_Y],
    ]),
    history: [],
    auditLog: [],
  };
}

describe("syncRopIdForReassignedClients", () => {
  it("sets rop_id to target team ROP", async () => {
    const state = baseState();
    const pool = createPool(state);
    await syncRopIdForReassignedClients(pool, [CODE_A], TEAM_Y);
    const row = state.dealerOverrides.get(DEALER_A_CLIENT);
    expect(row?.rop_id).toBe(ROP_Y_ID);
    expect(row?.rop_name).toBe("Купянский Родион");
  });

  it("does not change rop_id when target team has no ROP", async () => {
    const state = baseState();
    const pool = createPool(state);
    await syncRopIdForReassignedClients(pool, [CODE_A], TEAM_NO_ROP);
    expect(state.dealerOverrides.get(DEALER_A_CLIENT)?.rop_id).toBe(ROP_X_ID);
  });

  it("overwrites non-empty rop_id on explicit reassignment", async () => {
    const state = baseState();
    const pool = createPool(state);
    await syncRopIdForReassignedClients(pool, [CODE_A], TEAM_Y);
    expect(state.dealerOverrides.get(DEALER_A_CLIENT)?.rop_id).toBe(ROP_Y_ID);
  });
});

describe("handleClientsReassign rop_id sync", () => {
  it("reassigns client_assignments and syncs rop_id to new team ROP", async () => {
    const state = baseState();
    state.memberships.set(MANAGER_B, TEAM_Y);
    const pool = createPool(state);
    const res = mockRes();

    await handleClientsReassign(
      mockReq({ toUserId: MANAGER_B, clientCodes: [CODE_A], reason: "move" }),
      asRes(res),
      pool,
      { id: ADMIN_ID, role: "admin", status: "active" },
    );

    expect(res.statusCode).toBe(200);
    expect(res.body?.reassigned).toBe(1);
    expect(state.assignments.get(CODE_A)?.responsible_user_id).toBe(MANAGER_B);
    expect(state.assignments.get(CODE_A)?.team_id).toBe(TEAM_Y);
    expect(state.dealerOverrides.get(DEALER_A_CLIENT)?.rop_id).toBe(ROP_Y_ID);
    expect(state.dealerOverrides.get(DEALER_A_CLIENT)?.rop_name).toBe("Купянский Родион");
    expect(state.history).toHaveLength(1);
    expect(state.auditLog).toHaveLength(1);
  });

  it("leaves rop_id unchanged when target team has no ROP", async () => {
    const state = baseState();
    state.memberships.set(MANAGER_B, TEAM_NO_ROP);
    const pool = createPool(state);
    const res = mockRes();

    await handleClientsReassign(
      mockReq({ toUserId: MANAGER_B, clientCodes: [CODE_A] }),
      asRes(res),
      pool,
      { id: ADMIN_ID, role: "admin", status: "active" },
    );

    expect(res.statusCode).toBe(200);
    expect(state.dealerOverrides.get(DEALER_A_CLIENT)?.rop_id).toBe(ROP_X_ID);
  });

  it("updates existing override by alternate dealer_id format without duplicate", async () => {
    const state = baseState();
    state.dealerOverrides.delete(DEALER_A_CLIENT);
    state.dealerOverrides.set(DEALER_A_UUID, {
      dealer_id: DEALER_A_UUID,
      rop_id: ROP_X_ID,
      rop_name: "ROP X",
    });
    state.memberships.set(MANAGER_B, TEAM_Y);
    const pool = createPool(state);
    const res = mockRes();

    await handleClientsReassign(
      mockReq({ toUserId: MANAGER_B, clientCodes: [CODE_A] }),
      asRes(res),
      pool,
      { id: ADMIN_ID, role: "admin", status: "active" },
    );

    expect(res.statusCode).toBe(200);
    expect(state.dealerOverrides.size).toBe(1);
    const updated = state.dealerOverrides.get(DEALER_A_UUID);
    expect(updated?.rop_id).toBe(ROP_Y_ID);
    expect(state.dealerOverrides.has(DEALER_A_CLIENT)).toBe(false);
  });

  it("ROP can reassign inside team and rop_id stays on same ROP", async () => {
    const state = baseState();
    state.memberships.set(MANAGER_B, TEAM_X);
    const pool = createPool(state);
    const res = mockRes();

    await handleClientsReassign(
      mockReq({ toUserId: MANAGER_B, clientCodes: [CODE_B] }),
      asRes(res),
      pool,
      { id: ROP_X_ID, role: "rop", status: "active" },
    );

    expect(res.statusCode).toBe(200);
    expect(state.assignments.get(CODE_B)?.responsible_user_id).toBe(MANAGER_B);
    const override = state.dealerOverrides.get("client-ma-ma085530");
    expect(override?.rop_id).toBe(ROP_X_ID);
  });
});
