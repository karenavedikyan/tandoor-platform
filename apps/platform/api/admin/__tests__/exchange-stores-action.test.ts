import { describe, expect, it } from "vitest";
import { applyExchangeStoreAction } from "../../../shared/admin/exchange-stores-handlers.js";
import type { PoolLike } from "../../../server/db/neon-client.js";

const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STORE_ID = "11111111-1111-4111-8111-111111111101";
const TP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("exchange-stores-action", () => {
  it("create returns not implemented", async () => {
    const pool: PoolLike = {
      query: async () => ({ rows: [{ status: "new" }] }),
    };
    const result = await applyExchangeStoreAction(pool, ADMIN_ID, STORE_ID, "create");
    expect(result).toEqual({
      ok: false,
      code: "NOT_IMPLEMENTED",
      message: "Создание боевой ТТ пока не реализовано.",
    });
  });

  it("link requires existing trade point", async () => {
    const pool: PoolLike = {
      query: async (sql: string) => {
        if (sql.includes("SELECT status")) return { rows: [{ status: "new" }] };
        if (sql.includes("trade_points")) return { rows: [] };
        return { rows: [] };
      },
    };
    const result = await applyExchangeStoreAction(pool, ADMIN_ID, STORE_ID, "link", TP_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });
});
