import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../2026_07_08_exchange_users_legals.sql"),
  "utf8",
);

describe("exchange_users_legals migration", () => {
  it("creates exchange_users_raw", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS exchange_users_raw");
  });

  it("creates exchange_legals_raw with manager columns", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS exchange_legals_raw");
    expect(sql).toContain("regional_manager_1c UUID");
    expect(sql).toContain("responsible_manager_1c UUID");
  });

  it("does not touch production tables", () => {
    expect(sql).not.toContain("ALTER TABLE dealers");
    expect(sql).not.toContain("ALTER TABLE legal_entities");
    expect(sql).not.toContain("ALTER TABLE users");
    expect(sql).not.toContain("REFERENCES dealers");
  });
});
