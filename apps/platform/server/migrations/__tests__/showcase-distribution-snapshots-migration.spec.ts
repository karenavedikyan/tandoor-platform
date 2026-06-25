import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_06_16_showcase_distribution_snapshots.sql"), "utf8");

describe("showcase distribution snapshots migration", () => {
  it("creates showcase_distribution_snapshots table with indexes", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS showcase_distribution_snapshots");
    expect(sql).toContain("PRIMARY KEY (trade_point_id, snapshot_date)");
    expect(sql).toContain("idx_distribution_snapshots_tp_date");
    expect(sql).toContain("idx_distribution_snapshots_date");
  });

  it("defines capacity and on_shelf columns per type", () => {
    expect(sql).toContain("entrance_capacity");
    expect(sql).toContain("entrance_on_shelf");
    expect(sql).toContain("interior_capacity");
    expect(sql).toContain("interior_on_shelf");
    expect(sql).toContain("hardware_capacity");
    expect(sql).toContain("hardware_on_shelf");
  });
});
