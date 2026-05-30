import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "2026_05_31_dealer_tp_overrides.sql"), "utf8");

describe("dealer & trade point overrides migration", () => {
  it("creates dealer_overrides and events", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS dealer_overrides");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS dealer_override_events");
    expect(sql).toContain("unloading_order TEXT");
  });

  it("creates trade_point_overrides and training tables", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS trade_point_overrides");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS trade_point_training_state");
    expect(sql).toContain("showcase_status TEXT");
  });

  it("creates manual_dealers", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS manual_dealers");
  });
});
