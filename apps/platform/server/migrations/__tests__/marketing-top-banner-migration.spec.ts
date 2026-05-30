import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_05_31_marketing_top_banner.sql"), "utf8");

describe("marketing top banner migration", () => {
  it("adds category column with check", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS category");
    expect(sql).toContain("CHECK (category IN ('brief', 'promo', 'info'))");
  });

  it("creates user_brief_views", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS user_brief_views");
    expect(sql).toContain("PRIMARY KEY (user_id, brief_id)");
  });
});
