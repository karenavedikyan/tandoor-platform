import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(here, "..", "2026_06_05_showcase_placement_models_competitors.sql"),
  "utf8",
);

describe("showcase placement models/competitors migration (prompt 190)", () => {
  it("adds JSONB columns to entries and events", () => {
    expect(sql).toContain("ALTER TABLE showcase_matrix_entries");
    expect(sql).toContain("placement_our_models JSONB");
    expect(sql).toContain("placement_competitors JSONB");
    expect(sql).toContain("ALTER TABLE showcase_matrix_events");
  });

  it("is idempotent with IF NOT EXISTS", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS");
  });
});
