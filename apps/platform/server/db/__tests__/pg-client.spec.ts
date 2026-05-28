import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const endMock = vi.fn().mockResolvedValue(undefined);
const PoolMock = vi.fn(function PoolMock(this: { query: typeof queryMock; end: typeof endMock }) {
  this.query = queryMock;
  this.end = endMock;
});

vi.mock("pg", () => ({
  default: {
    Pool: PoolMock,
  },
}));

describe("pgSql", () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
    queryMock.mockResolvedValue({ rows: [{ id: 1 }] });
    endMock.mockClear();
    PoolMock.mockClear();
    delete process.env.PG_SSL_ROOT_CERT;
  });

  afterEach(async () => {
    const { closeAllPools } = await import("../pg-client.js");
    await closeAllPools();
  });

  it("buildTaggedQuery produces $1, $2 placeholders", async () => {
    const { buildTaggedQuery } = await import("../pg-client.js");
    const parts = Object.assign(["SELECT * FROM users WHERE id = ", " AND x = ", ""], {
      raw: ["SELECT * FROM users WHERE id = ", " AND x = ", ""],
    }) as TemplateStringsArray;
    const q = buildTaggedQuery(parts, ["u1", 42]);
    expect(q.text).toBe("SELECT * FROM users WHERE id = $1 AND x = $2");
    expect(q.values).toEqual(["u1", 42]);
  });

  it("tagged template calls pool.query with parameters", async () => {
    const { pgSql } = await import("../pg-client.js");
    const sql = pgSql("postgres://test/db");
    const userId = "abc";
    const rows = await sql`SELECT * FROM users WHERE id = ${userId}`;
    expect(rows).toEqual([{ id: 1 }]);
    expect(queryMock).toHaveBeenCalledWith("SELECT * FROM users WHERE id = $1", ["abc"]);
  });

  it("direct call sql(query, params) works", async () => {
    const { pgSql } = await import("../pg-client.js");
    const sql = pgSql("postgres://test/db");
    await sql("SELECT $1", [42]);
    expect(queryMock).toHaveBeenCalledWith("SELECT $1", [42]);
  });

  it("sql.query works", async () => {
    const { pgSql } = await import("../pg-client.js");
    const sql = pgSql("postgres://test/db");
    await sql.query("SELECT $1", [7]);
    expect(queryMock).toHaveBeenCalledWith("SELECT $1", [7]);
  });

  it("reuses one Pool per URL", async () => {
    const { pgSql } = await import("../pg-client.js");
    pgSql("postgres://same/url");
    pgSql("postgres://same/url");
    pgSql("postgres://other/url");
    expect(PoolMock).toHaveBeenCalledTimes(2);
  });

  it("uses PG_SSL_ROOT_CERT when set", async () => {
    process.env.PG_SSL_ROOT_CERT = "-----BEGIN CERT-----\nTEST\n-----END CERT-----";
    vi.resetModules();
    queryMock.mockResolvedValue({ rows: [] });
    const { pgSql } = await import("../pg-client.js");
    pgSql("postgres://ssl-test/db");
    expect(PoolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ssl: expect.objectContaining({
          ca: process.env.PG_SSL_ROOT_CERT,
          rejectUnauthorized: true,
        }),
      }),
    );
  });
});
