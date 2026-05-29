import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDualMigrateSuccess, runOnYandex } from "../dual-db-migrate.js";

describe("runOnYandex", () => {
  const originalFetch = globalThis.fetch;
  const originalProxyUrl = process.env.YANDEX_PROXY_URL;
  const originalProxyToken = process.env.YANDEX_PROXY_TOKEN;

  beforeEach(() => {
    delete process.env.YANDEX_PROXY_URL;
    delete process.env.YANDEX_PROXY_TOKEN;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalProxyUrl === undefined) delete process.env.YANDEX_PROXY_URL;
    else process.env.YANDEX_PROXY_URL = originalProxyUrl;
    if (originalProxyToken === undefined) delete process.env.YANDEX_PROXY_TOKEN;
    else process.env.YANDEX_PROXY_TOKEN = originalProxyToken;
    vi.restoreAllMocks();
  });

  it("returns skipped without network when proxy env is missing", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    const res = await runOnYandex(["CREATE TABLE t (id int)"], ["t"]);

    expect(res).toEqual({
      skipped: true,
      reason: "YANDEX_PROXY_URL/TOKEN не настроены — Yandex DDL применяется руками через прокси.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

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

  it("returns true when yandex is skipped and neon is ok", () => {
    const neonOk = { applied: [{ sql: "CREATE", ok: true }], tables };
    const yandexSkipped = {
      skipped: true as const,
      reason: "YANDEX_PROXY_URL/TOKEN не настроены — Yandex DDL применяется руками через прокси.",
    };
    expect(isDualMigrateSuccess(neonOk, yandexSkipped, tables)).toBe(true);
  });

  it("returns false when a statement failed", () => {
    const bad = {
      applied: [{ sql: "CREATE", ok: false, error: "exists" }],
      tables,
    };
    const good = { applied: [{ sql: "CREATE", ok: true }], tables };
    expect(isDualMigrateSuccess(bad, good, tables)).toBe(false);
  });

  it("returns false when yandex has error and is not skipped", () => {
    const neonOk = { applied: [{ sql: "CREATE", ok: true }], tables };
    expect(isDualMigrateSuccess(neonOk, { error: "proxy down" }, tables)).toBe(false);
  });
});
