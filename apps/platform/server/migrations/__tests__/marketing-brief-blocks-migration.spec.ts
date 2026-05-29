import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_05_29_add_marketing_brief_blocks.sql"), "utf8");

describe("marketing_brief_blocks migration", () => {
  it("is idempotent (IF NOT EXISTS)", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS marketing_brief_blocks");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_marketing_brief_blocks_brief");
  });

  it("references marketing_briefs", () => {
    expect(sql).toContain("REFERENCES marketing_briefs(id) ON DELETE CASCADE");
  });
});
