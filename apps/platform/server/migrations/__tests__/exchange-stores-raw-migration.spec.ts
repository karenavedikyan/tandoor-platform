import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../2026_07_07_exchange_stores_raw.sql"),
  "utf8",
);

describe("exchange_stores_raw migration", () => {
  it("enables pg_trgm", () => {
    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  });

  it("creates exchange_stores_raw with status check", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS exchange_stores_raw");
    expect(sql).toContain("CHECK (status IN ('new', 'linked', 'ignored', 'created'))");
  });

  it("references trade_points without modifying production tables", () => {
    expect(sql).toContain("REFERENCES trade_points(id) ON DELETE SET NULL");
    expect(sql).not.toContain("ALTER TABLE trade_points");
    expect(sql).not.toContain("ALTER TABLE dealers");
    expect(sql).not.toContain("ALTER TABLE legal_entities");
  });

  it("creates trgm indexes", () => {
    expect(sql).toContain("idx_exch_stores_name_trgm");
    expect(sql).toContain("gin_trgm_ops");
  });
});
