import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(here, "..", "2026_06_29_showcase_placement_legacy_ours.sql"),
  "utf8",
);

describe("showcase placement legacy ours migration", () => {
  it("adds placement_legacy_ours to entries and events", () => {
    expect(sql).toContain("ALTER TABLE showcase_matrix_entries");
    expect(sql).toContain("placement_legacy_ours INTEGER");
    expect(sql).toContain("ALTER TABLE showcase_matrix_events");
  });

  it("is idempotent with IF NOT EXISTS", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS");
  });
});
