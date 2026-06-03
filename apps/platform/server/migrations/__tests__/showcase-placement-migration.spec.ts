import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_06_03_showcase_placement_types.sql"), "utf8");

describe("showcase placement types migration (prompt 155)", () => {
  it("adds placement columns to entries and events", () => {
    expect(sql).toContain("ALTER TABLE showcase_matrix_entries");
    expect(sql).toContain("placement_type TEXT");
    expect(sql).toContain("ALTER TABLE showcase_matrix_events");
  });

  it("extends target_kind check to include placement", () => {
    expect(sql).toContain("CHECK (target_kind IN ('model','variant','placement'))");
  });

  it("defines placement type and segment checks", () => {
    expect(sql).toContain("showcase_matrix_placement_type_check");
    expect(sql).toContain("branded_stand");
    expect(sql).toContain("showcase_matrix_placement_segment_check");
  });

  it("creates placement indexes", () => {
    expect(sql).toContain("idx_showcase_matrix_placement");
    expect(sql).toContain("idx_showcase_matrix_placement_ref");
  });
});
