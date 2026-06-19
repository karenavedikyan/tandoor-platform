import { describe, expect, it, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../../../../server/db/neon-client.js";
import {
  fetchAuditList,
  handleAdminAuditList,
  parseAuditListQuery,
  type AuditListQuery,
} from "../../../../shared/admin/audit-ui-handlers.js";

const ADMIN_ID = "d43940b0-f52f-413e-8de6-7d62d5dcc8b5";
const RM_ID = "bb0e6231-8c1e-46ae-9e0f-a1d9003d9b81";

vi.mock("../../../../shared/admin/admin-auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../shared/admin/admin-auth.js")>();
  return {
    ...actual,
    resolveCurrentUser: vi.fn(),
    sendJson: vi.fn((res: VercelResponse, status: number, body: Record<string, unknown>) => {
      (res as MockRes).statusCode = status;
      (res as MockRes).body = body;
    }),
  };
});

import { resolveCurrentUser } from "../../../../shared/admin/admin-auth.js";

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

function mockReq(query: Record<string, string>): VercelRequest {
  return { method: "GET", query } as VercelRequest;
}

function createPool(handlers: {
  count?: (sql: string, params: unknown[]) => number;
  rows?: (sql: string, params: unknown[]) => Record<string, unknown>[];
}): PoolLike {
  return {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      const s = sql.replace(/\s+/g, " ").trim();
      if (s.startsWith("SELECT COUNT")) {
        const n = handlers.count?.(s, params) ?? 0;
        return { rows: [{ n }] };
      }
      const rows = handlers.rows?.(s, params) ?? [];
      return { rows };
    }),
  };
}

const baseQuery: AuditListQuery = {
  source: "general",
  limit: 50,
  offset: 0,
};

describe("parseAuditListQuery", () => {
  it("rejects missing source", () => {
    const r = parseAuditListQuery({});
    expect(r).toEqual({ error: "Укажите корректный source." });
  });

  it("rejects invalid limit", () => {
    const r = parseAuditListQuery({ source: "general", limit: "999" });
    expect(r).toEqual({ error: "Параметр limit должен быть от 1 до 200." });
  });

  it("rejects negative offset", () => {
    const r = parseAuditListQuery({ source: "general", offset: "-1" });
    expect(r).toEqual({ error: "Параметр offset должен быть неотрицательным." });
  });
});

describe("fetchAuditList", () => {
  it("general happy path", async () => {
    const pool = createPool({
      count: () => 1,
      rows: (sql) => {
        if (sql.includes("FROM audit_log")) {
          return [
            {
              id: "a1",
              actor_user_id: ADMIN_ID,
              action: "auth.login",
              entity_type: "session",
              entity_id: "s1",
              metadata: { ip: "127.0.0.1" },
              created_at: "2026-06-01T10:00:00.000Z",
              actor_full_name: "Карен",
              actor_email: "karen@test.local",
              actor_role: "admin",
            },
          ];
        }
        return [];
      },
    });
    const result = await fetchAuditList(pool, baseQuery);
    expect(result.total).toBe(1);
    expect(result.rows[0]?.summary).toContain("auth.login");
    expect(result.rows[0]?.actorFullName).toBe("Карен");
  });

  it("client_assignments happy path", async () => {
    const pool = createPool({
      count: () => 1,
      rows: (sql) => {
        if (sql.includes("client_assignment_history")) {
          return [
            {
              id: "c1",
              client_code: "MA-001",
              from_user_id: RM_ID,
              to_user_id: ADMIN_ID,
              actor_user_id: ADMIN_ID,
              reason: null,
              created_at: "2026-06-01T10:00:00.000Z",
              from_full_name: "Серебряков",
              from_email: "rm@test.local",
              to_full_name: "Карен",
              to_email: "karen@test.local",
              actor_full_name: "Карен",
              actor_email: "karen@test.local",
              actor_role: "admin",
            },
          ];
        }
        return [];
      },
    });
    const result = await fetchAuditList(pool, { ...baseQuery, source: "client_assignments" });
    expect(result.rows[0]?.summary).toBe("Клиент MA-001: Серебряков → Карен");
  });

  it("dealer_responsibility happy path", async () => {
    const pool = createPool({
      count: () => 1,
      rows: (sql) => {
        if (sql.includes("dealer_responsibility_history")) {
          return [
            {
              id: "d1",
              dealer_id: "client-ma-001",
              responsible_role: "regional_manager",
              from_user_id: null,
              to_user_id: RM_ID,
              actor_user_id: ADMIN_ID,
              reason: null,
              created_at: "2026-06-01T10:00:00.000Z",
              from_full_name: null,
              from_email: null,
              to_full_name: "Серебряков",
              to_email: "rm@test.local",
              actor_full_name: "Карен",
              actor_email: "karen@test.local",
              actor_role: "admin",
            },
          ];
        }
        return [];
      },
    });
    const result = await fetchAuditList(pool, { ...baseQuery, source: "dealer_responsibility" });
    expect(result.rows[0]?.summary).toContain("client-ma-001");
    expect(result.rows[0]?.summary).toContain("regional_manager");
  });

  it("scope_diagnostics happy path", async () => {
    const pool = createPool({
      count: () => 1,
      rows: (sql) => {
        if (sql.includes("real_scope_audit_log")) {
          return [
            {
              id: "r1",
              occurred_at: "2026-06-01T10:00:00.000Z",
              user_id: ADMIN_ID,
              call_site: "dealer-base",
              profile_role: "manager",
              persona_user_id: "persona-1",
              real_user_id: ADMIN_ID,
              reason: "mock_fallback",
              event_count: 3,
              actor_full_name: "Карен",
              actor_email: "karen@test.local",
              actor_role: "admin",
            },
          ];
        }
        return [];
      },
    });
    const result = await fetchAuditList(pool, { ...baseQuery, source: "scope_diagnostics" });
    expect(result.rows[0]?.summary).toBe("dealer-base: разошлись mock vs real (3)");
  });

  it("overrides_api happy path", async () => {
    const pool = createPool({
      count: () => 1,
      rows: (sql) => {
        if (sql.includes("overrides_api_access_log")) {
          return [
            {
              id: "o1",
              route: "/api/dealer-overrides",
              method: "POST",
              actor_user_id: ADMIN_ID,
              body_summary: { dealerId: "x" },
              response_status: 200,
              response_code: null,
              duration_ms: 42,
              created_at: "2026-06-01T10:00:00.000Z",
              actor_full_name: "Карен",
              actor_email: "karen@test.local",
              actor_role: "admin",
            },
          ];
        }
        return [];
      },
    });
    const result = await fetchAuditList(pool, { ...baseQuery, source: "overrides_api" });
    expect(result.rows[0]?.summary).toBe("POST /api/dealer-overrides → 200 (42ms)");
  });
});

describe("handleAdminAuditList auth", () => {
  beforeEach(() => {
    vi.mocked(resolveCurrentUser).mockReset();
  });

  it("returns 403 for regional_manager", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue({
      id: RM_ID,
      email: "rm@test.local",
      full_name: "Серебряков",
      phone: null,
      role: "regional_manager",
      status: "active",
      must_change_password: false,
      last_login_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      telegram_user_id: null,
    });
    const res = mockRes();
    const pool = createPool({});
    await handleAdminAuditList(
      mockReq({ source: "general" }),
      asRes(res),
      pool,
      {},
    );
    expect(res.statusCode).toBe(403);
  });

  it("returns 200 for admin", async () => {
    vi.mocked(resolveCurrentUser).mockResolvedValue({
      id: ADMIN_ID,
      email: "karen@test.local",
      full_name: "Карен",
      phone: null,
      role: "admin",
      status: "active",
      must_change_password: false,
      last_login_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      telegram_user_id: null,
    });
    const pool = createPool({ count: () => 0, rows: () => [] });
    const res = mockRes();
    await handleAdminAuditList(
      mockReq({ source: "general" }),
      asRes(res),
      pool,
      {},
    );
    expect(res.body?.success).toBe(true);
    expect(res.body?.source).toBe("general");
  });
});
