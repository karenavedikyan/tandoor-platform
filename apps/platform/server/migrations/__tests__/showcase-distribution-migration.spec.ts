import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_06_22_showcase_distribution_state.sql"), "utf8");

describe("showcase distribution state migration (prompt 426)", () => {
  it("creates four tables with indexes", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS showcase_distribution_overrides");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS showcase_distribution_task_updates");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS showcase_distribution_history");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS showcase_distribution_recommendations");
    expect(sql).toContain("idx_showcase_dist_overrides_dealer");
    expect(sql).toContain("idx_showcase_dist_task_updates_dealer");
    expect(sql).toContain("idx_showcase_dist_history_dealer_at");
    expect(sql).toContain("idx_showcase_dist_recs_dealer");
  });

  it("enforces category_id check constraints", () => {
    expect(sql).toContain("category_id IN ('entrance_doors','interior_doors','hardware','molding')");
  });

  it("enforces status and result_kind checks", () => {
    expect(sql).toContain("status IN ('ok','attention','critical')");
    expect(sql).toContain("status IN ('new','in_progress','done','postponed','needs_rop')");
    expect(sql).toContain("result_kind IN ('added_models','agreed_installation','updated_samples','photo_report','client_refused')");
    expect(sql).toContain("bucket IN ('top20','novelty')");
  });
});
