import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const mockRunOnNeon = vi.fn();
const mockRunOnYandex = vi.fn();
const mockResolveCurrentUser = vi.fn();
const mockEnforceCsrfOrigin = vi.fn();
const mockGetPool = vi.fn();
const mockResolveNeonUrl = vi.fn();
const mockPoolQuery = vi.fn();

vi.mock("../../../shared/dual-db-migrate.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/dual-db-migrate.js")>();
  return {
    ...actual,
    runOnNeon: (...args: unknown[]) => mockRunOnNeon(...args),
    runOnYandex: (...args: unknown[]) => mockRunOnYandex(...args),
    resolveNeonUrl: (...args: unknown[]) => mockResolveNeonUrl(...args),
  };
});

vi.mock("../../../shared/admin/admin-auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../shared/admin/admin-auth.js")>();
  return {
    ...actual,
    enforceCsrfOrigin: (...args: unknown[]) => mockEnforceCsrfOrigin(...args),
    getPool: (...args: unknown[]) => mockGetPool(...args),
    resolveCurrentUser: (...args: unknown[]) => mockResolveCurrentUser(...args),
    sendJson: vi.fn((res: VercelResponse, status: number, body: Record<string, unknown>) => {
      (res as MockRes).statusCode = status;
      (res as MockRes).body = body;
    }),
  };
});

vi.mock("../../../server/db/neon-client.js", () => ({
  makePoolFromNeon: () => ({
    query: mockPoolQuery,
  }),
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => ({})),
}));

import handler, {
  CLIENTS_1C_MIGRATION_SQL,
  CLIENTS_1C_EXPECTED_OBJECTS,
  isClients1cNeonApplyOk,
  isClients1cYandexApplyOk,
} from "../migrate-clients-1c.js";

type MockRes = {
  statusCode: number;
  body: Record<string, unknown> | null;
};

function mockRes(): MockRes & VercelResponse {
  return { statusCode: 200, body: null } as MockRes & VercelResponse;
}

function mockReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return { method: "POST", headers: {}, ...overrides } as VercelRequest;
}

const neonOk = {
  applied: [{ sql: "clients_1c_foundation", ok: true }],
  tables: [] as string[],
};

describe("migrate-clients-1c", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnforceCsrfOrigin.mockReturnValue(true);
    mockGetPool.mockReturnValue({});
    mockResolveNeonUrl.mockReturnValue("postgres://test");
    mockRunOnYandex.mockResolvedValue(neonOk);
    mockPoolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("to_regclass")) {
        return {
          rows: [
            {
              v_store_distribution: true,
              mv_stores_1c: true,
              mv_clients_1c: true,
              refresh_clients_1c_mv: true,
            },
          ],
        };
      }
      if (sql.includes("mv_stores_1c")) {
        return {
          rows: [
            {
              stores: 10,
              clients: 5,
              distribution_rows: 20,
              stores_with_distribution: 3,
              stores_with_orders: 2,
            },
          ],
        };
      }
      return { rows: [] };
    });
  });

  describe("CLIENTS_1C_MIGRATION_SQL", () => {
    it("loads foundation migration as single script", () => {
      expect(CLIENTS_1C_MIGRATION_SQL).toContain("mv_clients_1c");
      expect(CLIENTS_1C_MIGRATION_SQL).toContain("refresh_clients_1c_mv");
      expect(CLIENTS_1C_MIGRATION_SQL).toContain("v_store_distribution");
    });
  });

  describe("CLIENTS_1C_EXPECTED_OBJECTS", () => {
    it("lists views, materialized views, and refresh function", () => {
      const names = CLIENTS_1C_EXPECTED_OBJECTS.map((o) => o.name);
      expect(names).toContain("v_store_distribution");
      expect(names).toContain("mv_stores_1c");
      expect(names).toContain("mv_clients_1c");
      expect(names).toContain("refresh_clients_1c_mv");
    });
  });

  describe("isClients1cNeonApplyOk", () => {
    it("requires all statements applied successfully", () => {
      expect(isClients1cNeonApplyOk(neonOk)).toBe(true);
      expect(
        isClients1cNeonApplyOk({
          applied: [{ sql: "x", ok: false, error: "fail" }],
          tables: [],
        }),
      ).toBe(false);
      expect(isClients1cNeonApplyOk({ error: "db down" })).toBe(false);
    });
  });

  describe("isClients1cYandexApplyOk", () => {
    it("accepts applied with ok statements or skipped", () => {
      expect(isClients1cYandexApplyOk(neonOk)).toBe(true);
      expect(isClients1cYandexApplyOk({ skipped: true, reason: "no url" })).toBe(true);
      expect(
        isClients1cYandexApplyOk({
          applied: [{ sql: "x", ok: false, error: "fail" }],
          tables: [],
        }),
      ).toBe(false);
    });
  });

  describe("POST handler", () => {
    it("rejects unauthenticated requests with 401", async () => {
      mockResolveCurrentUser.mockResolvedValue(null);
      const res = mockRes();
      await handler(mockReq(), res);
      expect(res.statusCode).toBe(401);
      expect(res.body).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
      expect(mockRunOnNeon).not.toHaveBeenCalled();
    });

    it("rejects non-admin with 403", async () => {
      mockResolveCurrentUser.mockResolvedValue({ id: "u1", role: "manager" });
      const res = mockRes();
      await handler(mockReq(), res);
      expect(res.statusCode).toBe(403);
      expect(res.body).toMatchObject({ ok: false, code: "FORBIDDEN" });
      expect(mockRunOnNeon).not.toHaveBeenCalled();
    });

    it("applies migration on Neon and Yandex for admin", async () => {
      mockResolveCurrentUser.mockResolvedValue({ id: "admin1", role: "admin" });
      mockRunOnNeon.mockResolvedValue(neonOk);

      const res = mockRes();
      await handler(mockReq(), res);

      expect(res.statusCode).toBe(200);
      expect(res.body).toMatchObject({
        ok: true,
        neon: {
          applied: true,
          smoke: {
            stores: 10,
            clients: 5,
            distribution_rows: 20,
            stores_with_distribution: 3,
            stores_with_orders: 2,
          },
        },
        yandex: { applied: true },
      });

      expect(mockRunOnNeon).toHaveBeenCalledTimes(1);
      const [stmts, tables] = mockRunOnNeon.mock.calls[0] as [string[], string[]];
      expect(stmts).toHaveLength(1);
      expect(stmts[0]).toContain("mv_clients_1c");
      expect(stmts[0]).toBe(CLIENTS_1C_MIGRATION_SQL);
      expect(tables).toEqual([]);

      expect(mockRunOnYandex).toHaveBeenCalledTimes(1);
      const [yStmts] = mockRunOnYandex.mock.calls[0] as [string[]];
      expect(yStmts[0]).toBe(CLIENTS_1C_MIGRATION_SQL);
    });
  });
});
