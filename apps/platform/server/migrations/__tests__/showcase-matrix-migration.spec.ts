import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_06_03_showcase_matrix.sql"), "utf8");

describe("showcase matrix migration (prompt 150)", () => {
  it("creates showcase_matrix_entries and events tables", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS showcase_matrix_entries");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS showcase_matrix_events");
  });

  it("defines CHECK constraints for target_kind and status", () => {
    expect(sql).toContain("CHECK (target_kind IN ('model','variant'))");
    expect(sql).toContain("CHECK (status IN ('need_install','installed','postponed','not_relevant'))");
  });

  it("creates unique index on trade point + target", () => {
    expect(sql).toContain("uq_showcase_matrix_entry");
    expect(sql).toContain("ON showcase_matrix_entries (trade_point_id, target_kind, target_id)");
  });

  it("creates partial unique index on client_op_id", () => {
    expect(sql).toContain("uq_showcase_matrix_client_op");
    expect(sql).toContain("ON showcase_matrix_entries (client_op_id) WHERE client_op_id IS NOT NULL");
  });
});
