import { describe, expect, it } from "vitest";
import { isDualMigrateSuccess } from "../dual-db-migrate.js";

describe("isDualMigrateSuccess", () => {
  const tables = ["marketing_briefs", "marketing_brief_revisions", "marketing_brief_blocks"];

  it("returns false when neon has error", () => {
    expect(
      isDualMigrateSuccess(
        { error: "no url" },
        { applied: [], tables },
        tables,
      ),
    ).toBe(false);
  });

  it("returns true when both have all tables and stmts ok", () => {
    const ok = { applied: [{ sql: "CREATE", ok: true }], tables };
    expect(isDualMigrateSuccess(ok, ok, tables)).toBe(true);
  });

  it("returns false when a statement failed", () => {
    const bad = {
      applied: [{ sql: "CREATE", ok: false, error: "exists" }],
      tables,
    };
    const good = { applied: [{ sql: "CREATE", ok: true }], tables };
    expect(isDualMigrateSuccess(bad, good, tables)).toBe(false);
  });
});
