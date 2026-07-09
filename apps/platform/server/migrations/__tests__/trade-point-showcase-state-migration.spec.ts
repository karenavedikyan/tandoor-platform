import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_07_12_trade_point_showcase_state.sql"), "utf8");

describe("trade point showcase state migration", () => {
  it("creates trade_point_showcase_state table with indexes", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS trade_point_showcase_state");
    expect(sql).toContain("trade_point_id text PRIMARY KEY");
    expect(sql).toContain("idx_tp_showcase_state_dealer");
    expect(sql).toContain("idx_tp_showcase_state_updated_at");
  });
});
