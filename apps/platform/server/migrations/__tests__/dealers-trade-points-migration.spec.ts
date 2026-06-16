import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_06_05_dealers_trade_points.sql"), "utf8");

describe("dealers trade points migration (prompt 348)", () => {
  it("creates dealers and trade_points tables", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS dealers");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS trade_points");
  });

  it("defines unique external_key on both tables", () => {
    expect(sql).toContain("external_key TEXT NOT NULL UNIQUE");
  });

  it("creates indexes for trade_points dealer and external_key", () => {
    expect(sql).toContain("idx_trade_points_dealer");
    expect(sql).toContain("idx_trade_points_external_key");
  });

  it("is additive only (no DROP)", () => {
    expect(sql.toUpperCase()).not.toContain("DROP TABLE");
    expect(sql.toUpperCase()).not.toContain("DROP COLUMN");
  });
});
