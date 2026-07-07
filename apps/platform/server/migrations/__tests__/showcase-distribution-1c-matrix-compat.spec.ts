import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_07_10_showcase_distribution_1c_matrix_compat.sql"), "utf8");

describe("showcase distribution 1c matrix compat migration", () => {
  it("alters target_id and adds events table", () => {
    expect(sql).toContain("ALTER COLUMN target_id TYPE TEXT");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS showcase_matrix_events_1c");
    expect(sql).toContain("uq_showcase_dist_1c_target");
    expect(sql).toContain("'variant'");
  });
});
