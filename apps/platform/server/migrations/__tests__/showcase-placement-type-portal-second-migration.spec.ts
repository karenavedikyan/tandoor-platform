import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(here, "..", "2026_06_29_showcase_placement_type_portal_second.sql"),
  "utf8",
);

describe("showcase placement type portal_second migration", () => {
  it("extends placement_type check with portal_second", () => {
    expect(sql).toContain("ALTER TABLE showcase_matrix_entries");
    expect(sql).toContain("showcase_matrix_placement_type_check");
    expect(sql).toContain("'portal_second'");
  });

  it("does not add new columns", () => {
    expect(sql).not.toContain("ADD COLUMN");
  });
});
