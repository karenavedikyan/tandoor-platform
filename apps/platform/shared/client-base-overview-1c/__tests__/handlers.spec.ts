import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PoolLike } from "../../../server/db/neon-client.js";
import type { OneCShowroomContext } from "../../one-c-showroom-context.js";

const mockResolveCurrentUser = vi.fn();
const mockLoadOneCShowroomContext = vi.fn();

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

vi.mock("../../one-c-showroom-context.js", () => ({
  loadOneCShowroomContext: (...args: unknown[]) => mockLoadOneCShowroomContext(...args),
}));

import {
  classifyHolding1cStatus,
  buildClientBaseOverview1c,
  handleClientBaseOverview1c,
  handleClientBaseManagerDetail1c,
  handleClientBaseClientsList1c,
  type Holding1cRow,
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

const HOLDING_ACTIVE: Holding1cRow = {
  holding_id_1c: "h-active",
  holding_name: "Активный холдинг",
  holding_inn: "7700000000",
  holding_city: "Москва",
  holding_region: "Москва",
  stores_count: 2,
  legals_count: 1,
  responsible_managers: ["Иванов И.И."],
  regional_managers: ["Петров П.П."],
  distribution_filled_count: 1,
  distribution_total_targets: 2,
  distribution_percent: 50,
  orders_last_90d_count: 3,
  orders_last_90d_amount: 5000,
  last_order_at: "2026-07-01T00:00:00.000Z",
  last_distribution_updated_at: "2026-07-05T00:00:00.000Z",
};

const HOLDING_POTENTIAL: Holding1cRow = {
  ...HOLDING_ACTIVE,
  holding_id_1c: "h-potential",
  holding_name: "Потенциальный",
  orders_last_90d_count: 0,
  orders_last_90d_amount: 0,
  last_order_at: null,
};

const HOLDING_ATTENTION: Holding1cRow = {
  ...HOLDING_ACTIVE,
  holding_id_1c: "h-attention",
  holding_name: "Внимание",
  orders_last_90d_count: 0,
  orders_last_90d_amount: 0,
  responsible_managers: [],
  last_order_at: null,
};

function emptyShowroomContext(): OneCShowroomContext {
  return {
    teams: [],
    usersById: new Map(),
    membershipsByTeam: new Map(),
    regionalNames: [],
    responsibleNames: [],
    matchedRegionalByUserId: new Map(),
    matchedResponsibleByUserId: new Map(),
    userIdByRegionalName: new Map(),
    userIdByResponsibleName: new Map(),
    activeManagerMatchedNames: [],
    activeRmMatchedNames: [],
    activeFilterNames: [],
    legalById: new Map(),
    storeRows: [],
    storesTotal: 0,
    legalsTotal: 0,
    last_imported_at: null,
  };
}

function mapHoldingToDbRow(h: Holding1cRow): Record<string, unknown> {
  return { ...h };
}

describe("classifyHolding1cStatus", () => {
  it("classifies active, potential, and attention", () => {
    expect(classifyHolding1cStatus(HOLDING_ACTIVE)).toBe("active");
    expect(classifyHolding1cStatus(HOLDING_POTENTIAL)).toBe("potential");
    expect(classifyHolding1cStatus(HOLDING_ATTENTION)).toBe("attention");
  });
});

describe("buildClientBaseOverview1c", () => {
  beforeEach(() => {
    mockLoadOneCShowroomContext.mockResolvedValue(emptyShowroomContext());
  });

  it("returns ClientBaseOverview shape with structure counters", async () => {
    const pool = createPool({
      onQuery: (sql) => {
        if (sql.includes("FROM mv_clients_1c")) {
          return {
            rows: [
              mapHoldingToDbRow(HOLDING_ACTIVE),
              mapHoldingToDbRow(HOLDING_POTENTIAL),
              mapHoldingToDbRow(HOLDING_ATTENTION),
            ],
          };
        }
        if (sql.includes("FROM mv_stores_1c")) {
          return {
            rows: [
              {
                store_id_1c: "s1",
                store_name: "ТТ 1",
                store_address: "ул. 1",
                holding_id_1c: "h-active",
                holding_name: "Активный холдинг",
                legal_id_1c: "l1",
                legal_name: "Юр 1",
                legal_inn: "7700000000",
                legal_city: "Москва",
                responsible_manager_name: "Иванов И.И.",
                regional_manager_name: "Петров П.П.",
                store_manager_name: null,
                distribution_percent: 50,
                orders_last_90d_count: 1,
                last_order_at: "2026-07-01T00:00:00.000Z",
                last_distribution_updated_at: null,
              },
            ],
          };
        }
        return { rows: [] };
      },
    });

    const payload = await buildClientBaseOverview1c(pool, null, null);
    expect(payload.success).toBe(true);
    expect(payload.structure).toMatchObject({
      activeClients: 1,
      potentialClients: 1,
      attentionClients: 1,
      tradePoints: 6,
      managersWithClientsWithoutTp: 0,
      citiesWithClientsWithoutTp: 0,
    });
    expect(payload.topActiveClients[0]?.clientId).toBe("h-active");
    expect(Array.isArray(payload.ropGroups)).toBe(true);
    expect(payload.cities.some((c) => c.city === "Москва")).toBe(true);
  });
});

describe("handlers auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadOneCShowroomContext.mockResolvedValue(emptyShowroomContext());
  });

  it("overview rejects unauthenticated", async () => {
    mockResolveCurrentUser.mockResolvedValue(null);
    const res = mockRes();
    await handleClientBaseOverview1c(mockReq(), res, createPool({}));
    expect(res.statusCode).toBe(401);
  });

  it("overview rejects non-admin", async () => {
    mockResolveCurrentUser.mockResolvedValue({ ...ADMIN, role: "manager" });
    const res = mockRes();
    await handleClientBaseOverview1c(mockReq(), res, createPool({}));
    expect(res.statusCode).toBe(403);
  });

  it("manager-detail rejects non-admin", async () => {
    mockResolveCurrentUser.mockResolvedValue({ ...ADMIN, role: "director" });
    const res = mockRes();
    await handleClientBaseManagerDetail1c(mockReq({ managerUserId: "m1" }), res, createPool({}));
    expect(res.statusCode).toBe(403);
  });

  it("clients-list rejects non-admin", async () => {
    mockResolveCurrentUser.mockResolvedValue({ ...ADMIN, role: "rop" });
    const res = mockRes();
    await handleClientBaseClientsList1c(mockReq(), res, createPool({}));
    expect(res.statusCode).toBe(403);
  });

  it("overview succeeds for admin with expected shape", async () => {
    mockResolveCurrentUser.mockResolvedValue(ADMIN);
    const pool = createPool({
      onQuery: (sql) => {
        if (sql.includes("FROM mv_clients_1c")) {
          return { rows: [mapHoldingToDbRow(HOLDING_ACTIVE)] };
        }
        return { rows: [] };
      },
    });
    const res = mockRes();
    await handleClientBaseOverview1c(mockReq(), res, pool);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      structure: {
        activeClients: 1,
        managersWithClientsWithoutTp: 0,
        citiesWithClientsWithoutTp: 0,
      },
    });
  });

  it("manager-detail requires managerUserId", async () => {
    mockResolveCurrentUser.mockResolvedValue(ADMIN);
    const res = mockRes();
    await handleClientBaseManagerDetail1c(mockReq(), res, createPool({}));
    expect(res.statusCode).toBe(400);
  });

  it("clients-list succeeds for admin", async () => {
    mockResolveCurrentUser.mockResolvedValue(ADMIN);
    const pool = createPool({
      onQuery: (sql) => {
        if (sql.includes("FROM mv_clients_1c")) {
          return { rows: [mapHoldingToDbRow(HOLDING_ACTIVE)] };
        }
        return { rows: [] };
      },
    });
    const res = mockRes();
    await handleClientBaseClientsList1c(mockReq(), res, pool);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      meta: {
        catalogTotal: 1,
        activeCount: 1,
      },
    });
    expect(Array.isArray(res.body?.clients)).toBe(true);
    expect(Array.isArray(res.body?.tradePoints)).toBe(true);
  });
});
