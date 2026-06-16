import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_06_17_dealer_db_diff_log.sql"), "utf8");

describe("dealer_db_diff_log migration (prompt 374)", () => {
  it("creates dealer_db_diff_log table", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS dealer_db_diff_log");
  });

  it("defines expected indexes", () => {
    expect(sql).toContain("idx_dealer_db_diff_log_key");
    expect(sql).toContain("idx_dealer_db_diff_log_detected");
    expect(sql).toContain("idx_dealer_db_diff_log_kind");
  });

  it("is additive only (no DROP)", () => {
    expect(sql.toUpperCase()).not.toContain("DROP TABLE");
  });
});
