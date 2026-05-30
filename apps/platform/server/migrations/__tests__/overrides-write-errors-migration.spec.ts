import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_05_31_overrides_write_errors.sql"), "utf8");

describe("overrides_write_errors migration", () => {
  it("creates overrides_write_errors table", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS overrides_write_errors");
    expect(sql).toContain("entity_kind TEXT NOT NULL");
  });
});
