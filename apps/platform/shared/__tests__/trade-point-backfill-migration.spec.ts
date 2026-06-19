/**
 * Промт 422: backfill migration — one primary per dealer.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "../../server/migrations/2026_06_20_trade_point_is_primary.sql"), "utf8");

describe("trade_point is_primary migration (prompt 422)", () => {
  it("adds is_primary column and indexes", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false");
    expect(sql).toContain("idx_tpo_dealer_primary");
    expect(sql).toContain("uq_tpo_dealer_one_primary");
  });

  it("backfills exactly one primary per dealer among active rows", () => {
    expect(sql).toContain("ROW_NUMBER() OVER (PARTITION BY dealer_id");
    expect(sql).toContain("WHERE status = 'active' AND dealer_id IS NOT NULL");
    expect(sql).toContain("SET is_primary = true");
    expect(sql).toContain("ranked.rn = 1");
  });
});
