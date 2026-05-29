import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_05_30_add_marketing_brief_visibility.sql"), "utf8");

describe("marketing_brief visibility migration", () => {
  it("adds visibility column with check", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS visibility");
    expect(sql).toMatch(/visibility IN \('private', 'public'\)/);
    expect(sql).toContain("DEFAULT 'private'");
  });
});
