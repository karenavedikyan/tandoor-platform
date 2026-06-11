import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_06_15_marketing_brief_category_letter.sql"), "utf8");

describe("marketing brief category letter migration", () => {
  it("extends category check to include letter", () => {
    expect(sql).toContain("DROP CONSTRAINT IF EXISTS marketing_briefs_category_check");
    expect(sql).toContain("CHECK (category IN ('brief', 'promo', 'info', 'letter'))");
  });
});
