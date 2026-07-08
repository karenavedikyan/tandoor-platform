import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../../../server/db/neon-client.js";

const mockResolveCurrentUser = vi.fn();

vi.mock("../../admin/admin-auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../admin/admin-auth.js")>();
  return {
    ...actual,
    resolveCurrentUser: (...args: unknown[]) => mockResolveCurrentUser(...args),
    sendJson: vi.fn((res: VercelResponse, status: number, body: Record<string, unknown>) => {
      (res as MockRes).statusCode = status;
      (res as MockRes).body = body;
    }),
  };
});

import {
  fetchClients1cList,
  fetchClients1cHolding,
  fetchClients1cStore,
  handleClients1cList,
  handleClients1cHolding,
  handleClients1cStore,
  parseClients1cListQuery,
} from "../handlers.js";

type MockRes = { statusCode: number; body: Record<string, unknown> | null };

function mockRes(): MockRes & VercelResponse {
  return { statusCode: 200, body: null } as MockRes & VercelResponse;
}

function mockReq(query: Record<string, string> = {}, method = "GET"): VercelRequest {
  return { method, headers: {}, query } as VercelRequest;
}

function createPool(handlers: {
  onQuery?: (sql: string, params: unknown[]) => unknown;
}): PoolLike {
  return {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      const result = handlers.onQuery?.(sql, params);
      if (result !== undefined) return result;
      return { rows: [] };
    }),
  };
}

const ADMIN = {
  id: "admin-1",
  role: "admin",
  email: "a@test.local",
  full_name: "Admin",
  phone: null,
  status: "active",
  must_change_password: false,
  last_login_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  telegram_user_id: null,
};

describe("parseClients1cListQuery", () => {
  it("defaults page and pageSize", () => {
    expect(parseClients1cListQuery(mockReq())).toMatchObject({ page: 1, pageSize: 50, sort: "name" });
  });

  it("caps pageSize at 200", () => {
    expect(parseClients1cListQuery(mockReq({ pageSize: "500" })).pageSize).toBe(200);
  });
});

describe("fetchClients1cList", () => {
  it("returns paginated items", async () => {
    const pool = createPool({
      onQuery: (sql) => {
        if (sql.includes("COUNT(*)")) return { rows: [{ n: 1 }] };
        if (sql.includes("MAX(refreshed_at)")) return { rows: [{ refreshed_at: "2026-07-08T12:00:00.000Z" }] };
        if (sql.includes("FROM mv_clients_1c")) {
          return {
            rows: [
              {
                holding_id_1c: "h1",
                holding_name: "Холдинг 1",
                holding_inn: "123",
                holding_city: "Москва",
                stores_count: 2,
                legals_count: 1,
                responsible_managers: ["Иванов"],
                regional_managers: ["Петров"],
                distribution_filled_count: 1,
                distribution_total_targets: 2,
                distribution_percent: 50,
                orders_last_90d_count: 3,
                orders_last_90d_amount: 1000,
                last_order_at: "2026-07-01T00:00:00.000Z",
              },
            ],
          };
        }
        return { rows: [] };
      },
    });

    const res = await fetchClients1cList(pool, {
      search: "",
      city: "",
      region: "",
      hasDistribution: "any",
      hasOrders: "any",
      sort: "name",
      page: 1,
      pageSize: 50,
    });
    expect(res.ok).toBe(true);
    expect(res.total).toBe(1);
    expect(res.items[0]?.holding_name).toBe("Холдинг 1");
  });
});

describe("fetchClients1cHolding", () => {
  it("returns null when holding missing", async () => {
    const pool = createPool({});
    const res = await fetchClients1cHolding(pool, "missing-id");
    expect(res).toBeNull();
  });
});

describe("fetchClients1cStore", () => {
  it("returns null on holding-store mismatch", async () => {
    const pool = createPool({ onQuery: () => ({ rows: [] }) });
    const res = await fetchClients1cStore(pool, "h1", "s1");
    expect(res).toBeNull();
  });
});

describe("handlers auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("list rejects unauthenticated", async () => {
    mockResolveCurrentUser.mockResolvedValue(null);
    const res = mockRes();
    await handleClients1cList(mockReq(), res, createPool({}));
    expect(res.statusCode).toBe(401);
  });

  it("list rejects non-admin", async () => {
    mockResolveCurrentUser.mockResolvedValue({ ...ADMIN, role: "manager" });
    const res = mockRes();
    await handleClients1cList(mockReq(), res, createPool({}));
    expect(res.statusCode).toBe(403);
  });

  it("holding returns 404 when not found", async () => {
    mockResolveCurrentUser.mockResolvedValue(ADMIN);
    const res = mockRes();
    await handleClients1cHolding(mockReq(), res, createPool({}), "h-missing");
    expect(res.statusCode).toBe(404);
  });

  it("store returns 404 on mismatch", async () => {
    mockResolveCurrentUser.mockResolvedValue(ADMIN);
    const res = mockRes();
    await handleClients1cStore(mockReq(), res, createPool({}), "h1", "s1");
    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: "NOT_FOUND" });
  });

  it("list succeeds for admin", async () => {
    mockResolveCurrentUser.mockResolvedValue(ADMIN);
    const pool = createPool({
      onQuery: (sql) => {
        if (sql.includes("COUNT(*)")) return { rows: [{ n: 0 }] };
        if (sql.includes("MAX(refreshed_at)")) return { rows: [{ refreshed_at: null }] };
        return { rows: [] };
      },
    });
    const res = mockRes();
    await handleClients1cList(mockReq(), res, pool);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, total: 0 });
  });
});
