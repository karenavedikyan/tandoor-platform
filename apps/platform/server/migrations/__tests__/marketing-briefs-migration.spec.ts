import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_05_29_add_marketing_briefs.sql"), "utf8");

describe("marketing_briefs migration", () => {
  it("is idempotent (IF NOT EXISTS)", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS marketing_briefs");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS marketing_brief_revisions");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_marketing_briefs_status");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_marketing_brief_revisions_brief");
  });

  it("defines expected status check", () => {
    expect(sql).toMatch(/status IN \('draft','published','archived'\)/);
  });
});
