import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PoolLike } from "../../../server/db/neon-client.js";
import {
  parseExchangeStoresXml,
  SAMPLE_STORES_XML,
} from "../../../shared/admin/exchange-stores-xml-parser.js";
import {
  upsertExchangeStoresBatch,
  applyExchangeStoreAction,
} from "../../../shared/admin/exchange-stores-handlers.js";

describe("parseExchangeStoresXml", () => {
  it("parses sample XML into 5 store rows", async () => {
    const rows = await parseExchangeStoresXml(SAMPLE_STORES_XML);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({
      id_1c: "11111111-1111-4111-8111-111111111101",
      name: "Двери Центр",
      address: "Москва, ул. Ленина 1",
      legal_entity_1c: "22222222-2222-4222-8222-222222222201",
      manager_1c: "33333333-3333-4333-8333-333333333301",
      manager_name: "Иванов Иван Иваныч",
      manager_phone: "79001234567",
    });
    const withoutManager = rows.find((r) => r.name === "Окна Север");
    expect(withoutManager?.manager_1c).toBeNull();
  });
});

describe("upsertExchangeStoresBatch", () => {
  function createPool(state: {
    existing?: Array<{
      id_1c: string;
      status: string;
      name: string;
      address: string | null;
      legal_entity_1c: string | null;
      manager_1c: string | null;
      manager_name: string | null;
      manager_phone: string | null;
    }>;
  }): PoolLike {
    const existing = new Map((state.existing ?? []).map((r) => [r.id_1c, r]));
    return {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        const s = sql.replace(/\s+/g, " ").trim();
        if (s.includes("SELECT id_1c, status")) {
          const ids = params[0] as string[];
          const rows = ids
            .map((id) => existing.get(id))
            .filter(Boolean) as NonNullable<(typeof state.existing)[number]>[];
          return { rows };
        }
        if (s.startsWith("INSERT INTO exchange_stores_raw")) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    };
  }

  it("counts inserted for new rows", async () => {
    const pool = createPool({});
    const rows = await parseExchangeStoresXml(SAMPLE_STORES_XML);
    const stats = await upsertExchangeStoresBatch(pool, rows.slice(0, 2), "/import_stores/stores1.xml");
    expect(stats.inserted).toBe(2);
    expect(stats.skipped_locked).toBe(0);
  });

  it("skips locked linked records from field updates", async () => {
    const pool = createPool({
      existing: [
        {
          id_1c: "11111111-1111-4111-8111-111111111101",
          status: "linked",
          name: "Старое имя",
          address: null,
          legal_entity_1c: null,
          manager_1c: null,
          manager_name: null,
          manager_phone: null,
        },
      ],
    });
    const rows = await parseExchangeStoresXml(SAMPLE_STORES_XML);
    const stats = await upsertExchangeStoresBatch(pool, [rows[0]!], "/import_stores/stores1.xml");
    expect(stats.skipped_locked).toBe(1);
    expect(stats.updated).toBe(0);
    expect(stats.inserted).toBe(0);
  });
});

describe("applyExchangeStoreAction", () => {
  const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const STORE_ID = "11111111-1111-4111-8111-111111111101";
  const TP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  let status = "new";
  let linkedTp: string | null = null;
  let linkedAt: string | null = null;
  let linkedBy: string | null = null;

  function pool(): PoolLike {
    return {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        const s = sql.replace(/\s+/g, " ").trim();
        if (s.includes("SELECT status FROM exchange_stores_raw")) {
          return status ? { rows: [{ status }] } : { rows: [] };
        }
        if (s.includes("SELECT id FROM trade_points")) {
          return { rows: [{ id: TP_ID }] };
        }
        if (s.startsWith("UPDATE exchange_stores_raw")) {
          const actionSql = sql.toLowerCase();
          if (actionSql.includes("status = 'linked'")) {
            status = "linked";
            linkedTp = params[1] as string;
            linkedBy = params[2] as string;
            linkedAt = new Date().toISOString();
          } else if (actionSql.includes("status = 'ignored'")) {
            status = "ignored";
            linkedTp = null;
            linkedAt = null;
            linkedBy = null;
          } else if (actionSql.includes("status = 'new'")) {
            status = "new";
            linkedTp = null;
            linkedAt = null;
            linkedBy = null;
          }
          return { rows: [] };
        }
        return { rows: [] };
      }),
    };
  }

  beforeEach(() => {
    status = "new";
    linkedTp = null;
    linkedAt = null;
    linkedBy = null;
  });

  it("link sets linked status and metadata", async () => {
    const result = await applyExchangeStoreAction(pool(), ADMIN_ID, STORE_ID, "link", TP_ID);
    expect(result).toEqual({ ok: true });
    expect(status).toBe("linked");
    expect(linkedTp).toBe(TP_ID);
    expect(linkedBy).toBe(ADMIN_ID);
    expect(linkedAt).toBeTruthy();
  });

  it("ignore clears link fields", async () => {
    status = "new";
    const result = await applyExchangeStoreAction(pool(), ADMIN_ID, STORE_ID, "ignore");
    expect(result).toEqual({ ok: true });
    expect(status).toBe("ignored");
    expect(linkedTp).toBeNull();
  });

  it("reset returns to new", async () => {
    status = "linked";
    const result = await applyExchangeStoreAction(pool(), ADMIN_ID, STORE_ID, "reset");
    expect(result).toEqual({ ok: true });
    expect(status).toBe("new");
    expect(linkedTp).toBeNull();
  });
});
