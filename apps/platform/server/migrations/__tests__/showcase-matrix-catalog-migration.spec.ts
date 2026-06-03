import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_06_03_showcase_matrix_catalog.sql"), "utf8");

describe("showcase matrix catalog migration (prompt 159)", () => {
  it("creates showcase_matrix_defs and def_models tables", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS showcase_matrix_defs");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS showcase_matrix_def_models");
  });

  it("defines client_category and scope checks", () => {
    expect(sql).toContain("showcase_matrix_defs_client_category_check");
    expect(sql).toContain("top500plus");
    expect(sql).toContain("showcase_matrix_defs_scope_kind_check");
    expect(sql).toContain("'global','region','city'");
  });

  it("defines scope NULL normalization check", () => {
    expect(sql).toContain("showcase_matrix_defs_scope_fields_check");
  });

  it("creates resolution and idempotency indexes", () => {
    expect(sql).toContain("uq_showcase_matrix_defs_client_op");
    expect(sql).toContain("idx_showcase_matrix_defs_resolve");
    expect(sql).toContain("uq_smdm_def_target");
  });
});
