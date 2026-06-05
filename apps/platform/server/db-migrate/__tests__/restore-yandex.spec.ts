import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  batchRowLimitForColumns,
  buildBatchInsertQuery,
  buildInsertQuery,
  groupRowsByTable,
  parseJsonlGzip,
  quoteIdent,
  serializeCellValue,
  splitSqlStatements,
  type JsonlEntry,
} from "../restore-yandex.js";

function makeJsonlGzip(lines: Array<{ table: string; row: Record<string, unknown> }>): Buffer {
  const body = lines.map((l) => JSON.stringify(l)).join("\n");
  return gzipSync(Buffer.from(body, "utf8"));
}

describe("splitSqlStatements", () => {
  it("разбивает простые statement'ы по ;", () => {
    const sql = `CREATE TABLE a (id int); CREATE TABLE b (id int);`;
    expect(splitSqlStatements(sql)).toEqual([`CREATE TABLE a (id int)`, `CREATE TABLE b (id int)`]);
  });

  it("не режет $$ ... $$ блоки", () => {
    const sql = `
      DO $$ BEGIN
        ALTER TABLE x ADD CONSTRAINT fk FOREIGN KEY (a) REFERENCES y(id);
      END $$;
      CREATE TABLE z (id int);
    `;
    const result = splitSqlStatements(sql);
    expect(result.length).toBe(2);
    expect(result[0]).toContain("DO $$ BEGIN");
    expect(result[0]).toContain("END $$");
    expect(result[1]).toContain("CREATE TABLE z");
  });

  it("уважает $tag$ ... $tag$ с произвольным тегом", () => {
    const sql = `
      DO $body$ BEGIN
        SELECT 1; SELECT 2;
      END $body$;
      SELECT 3;
    `;
    const result = splitSqlStatements(sql);
    expect(result.length).toBe(2);
    expect(result[0]).toContain("$body$");
    expect(result[1]).toBe(`SELECT 3`);
  });

  it("игнорирует ; внутри одинарных кавычек", () => {
    const sql = `INSERT INTO t(a) VALUES ('hello; world'); SELECT 1;`;
    const result = splitSqlStatements(sql);
    expect(result.length).toBe(2);
    expect(result[0]).toContain(`'hello; world'`);
  });

  it("обрабатывает экранированные кавычки ''", () => {
    const sql = `INSERT INTO t(a) VALUES ('it''s ok'); SELECT 1;`;
    const result = splitSqlStatements(sql);
    expect(result.length).toBe(2);
  });

  it("игнорирует ; в однострочных комментариях", () => {
    const sql = `-- comment; with semicolon\nSELECT 1;`;
    const result = splitSqlStatements(sql);
    expect(result.length).toBe(1);
    expect(result[0]).toContain("SELECT 1");
  });

  it("игнорирует ; в блочных комментариях", () => {
    const sql = `/* a; b; c */ SELECT 1; SELECT 2;`;
    const result = splitSqlStatements(sql);
    expect(result.length).toBe(2);
  });

  it("возвращает пустой массив для пустой строки", () => {
    expect(splitSqlStatements("")).toEqual([]);
    expect(splitSqlStatements("   \n\n  ")).toEqual([]);
  });
});

describe("parseJsonlGzip", () => {
  it("parses gzipped JSONL into table/row entries", () => {
    const buf = makeJsonlGzip([
      { table: "users", row: { id: "u1", email: "a@b.c" } },
      { table: "sessions", row: { id: "s1" } },
    ]);
    const entries = parseJsonlGzip(buf);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ table: "users", row: { id: "u1", email: "a@b.c" } });
    expect(entries[1]?.table).toBe("sessions");
  });

  it("throws on invalid line shape", () => {
    const buf = gzipSync(Buffer.from(JSON.stringify({ nope: true }), "utf8"));
    expect(() => parseJsonlGzip(buf)).toThrow(/missing table/i);
  });
});

describe("groupRowsByTable", () => {
  it("groups entries preserving per-table order", () => {
    const entries: JsonlEntry[] = [
      { table: "b", row: { id: 1 }, lineIndex: 1 },
      { table: "a", row: { id: 2 }, lineIndex: 2 },
      { table: "b", row: { id: 3 }, lineIndex: 3 },
    ];
    const grouped = groupRowsByTable(entries);
    expect(Array.from(grouped.keys())).toEqual(["b", "a"]);
    expect(grouped.get("b")?.map((e) => e.row.id)).toEqual([1, 3]);
  });
});

describe("buildInsertQuery", () => {
  it("builds parameterized INSERT with ON CONFLICT on id", () => {
    const { text } = buildInsertQuery("users", ["id", "email"], ["id"]);
    expect(text).toContain(`INSERT INTO ${quoteIdent("users")}`);
    expect(text).toContain("ON CONFLICT");
    expect(text).toContain("$1, $2");
    expect(text).toContain(quoteIdent("id"));
  });
});

describe("buildBatchInsertQuery", () => {
  it("builds multi-row INSERT with sequential placeholders", () => {
    const text = buildBatchInsertQuery("users", ["id", "email"], ["id"], 2);
    expect(text).toContain(`INSERT INTO ${quoteIdent("users")}`);
    expect(text).toContain("VALUES ($1, $2), ($3, $4)");
    expect(text).toContain("ON CONFLICT");
  });

  it("serializes jsonb in batch value order", () => {
    const cols = ["id", "placement_our_models"];
    const text = buildBatchInsertQuery("showcase_matrix_entries", cols, ["id"], 1);
    expect(text).toContain(quoteIdent("placement_our_models"));
    const jsonVal = serializeCellValue([{ modelId: "m1", count: 2 }], true);
    expect(jsonVal).toBe('[{"modelId":"m1","count":2}]');
  });
});

describe("batchRowLimitForColumns", () => {
  it("caps batch size by pg parameter limit", () => {
    expect(batchRowLimitForColumns(2)).toBe(200);
    expect(batchRowLimitForColumns(400)).toBe(163);
  });
});

describe("serializeCellValue", () => {
  it("stringifies jsonb objects and ISO-dates", () => {
    expect(serializeCellValue({ a: 1 }, true)).toBe('{"a":1}');
    expect(serializeCellValue(new Date("2026-05-28T00:00:00.000Z"), false)).toBe("2026-05-28T00:00:00.000Z");
  });
});

describe("row insert error isolation", () => {
  it("records error for one bad row without failing others", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("invalid input syntax"))
      .mockResolvedValueOnce({ rows: [] });

    const client = { query };
    const errors: Array<{ table: string; rowIndex: number; error: string }> = [];
    const columnMeta = [
      { name: "id", isJson: false },
      { name: "email", isJson: false },
    ];
    const entries: JsonlEntry[] = [
      { table: "users", row: { id: "ok", email: "a@b.c" }, lineIndex: 1 },
      { table: "users", row: { id: "bad", email: null }, lineIndex: 2 },
      { table: "users", row: { id: "ok2", email: "c@d.e" }, lineIndex: 3 },
    ];

    const { text } = buildInsertQuery("users", ["id", "email"], ["id"]);
    for (const entry of entries) {
      const columns = ["id", "email"];
      const values = columns.map((c) => serializeCellValue(entry.row[c], false));
      try {
        await client.query(text, values);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push({ table: entry.table, rowIndex: entry.lineIndex, error: message });
      }
    }

    expect(query).toHaveBeenCalledTimes(3);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ rowIndex: 2, error: "invalid input syntax" });
  });
});
