import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_07_09_showcase_distribution_1c.sql"), "utf8");

describe("showcase distribution 1c migration", () => {
  it("creates three shadow tables with indexes", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS showcase_matrix_1c");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS showcase_distribution_overrides_1c");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS showcase_distribution_history_1c");
    expect(sql).toContain("idx_showcase_matrix_1c_updated");
    expect(sql).toContain("idx_showcase_dist_1c_store");
    expect(sql).toContain("uq_showcase_dist_1c_op");
    expect(sql).toContain("idx_showcase_dist_hist_1c_store");
  });

  it("enforces category_id and action checks", () => {
    expect(sql).toContain("category_id IN ('entrance_doors','interior_doors','hardware','molding')");
    expect(sql).toContain("action IN ('create','update','delete','matrix_upsert')");
  });
});
