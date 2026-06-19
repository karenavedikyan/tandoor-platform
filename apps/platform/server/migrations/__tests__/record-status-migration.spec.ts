import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_06_19_record_status.sql"), "utf8");

describe("record_status migration (prompt 417)", () => {
  it("creates record_status enum", () => {
    expect(sql).toContain("CREATE TYPE record_status AS ENUM");
    expect(sql).toContain("'active'");
    expect(sql).toContain("'in_trash'");
    expect(sql).toContain("'pending_admin'");
    expect(sql).toContain("'purged'");
  });

  it("adds status column to both override tables", () => {
    expect(sql).toContain("ALTER TABLE dealer_overrides");
    expect(sql).toContain("ALTER TABLE trade_point_overrides");
    expect(sql).toContain("status record_status NOT NULL DEFAULT 'active'");
  });

  it("backfills status from timestamp columns", () => {
    expect(sql).toContain("WHEN purged_at IS NOT NULL");
    expect(sql).toContain("WHEN purge_requested_at IS NOT NULL");
    expect(sql).toContain("WHEN trashed_at IS NOT NULL");
  });

  it("creates status indexes", () => {
    expect(sql).toContain("dealer_overrides_status_idx");
    expect(sql).toContain("trade_point_overrides_status_idx");
  });
});
