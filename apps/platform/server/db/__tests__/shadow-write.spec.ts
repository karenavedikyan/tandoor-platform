import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envBackup = { ...process.env };

async function loadShadowWrite() {
  vi.resetModules();
  return import("../shadow-write.js");
}

describe("shadowWrite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...envBackup };
    process.env.PG_PROXY_URL = "https://proxy.example";
    process.env.PG_PROXY_TOKEN = "test-token";
    process.env.SHADOW_WRITE_ENABLED = "1";
  });

  afterEach(() => {
    process.env = envBackup;
    vi.restoreAllMocks();
  });

  it("does not throw when proxy ENV is missing", async () => {
    delete process.env.PG_PROXY_URL;
    const { shadowWrite } = await loadShadowWrite();
    await expect(shadowWrite("INSERT INTO users (id) VALUES ($1)", ["x"], "test")).resolves.toBeUndefined();
  });

  it("does not throw on network error from fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { shadowWrite } = await loadShadowWrite();
    await shadowWrite("INSERT INTO users (id) VALUES ($1)", ["x"], "net");
    expect(warn).toHaveBeenCalled();
  });

  it("refuses TRUNCATE/DROP/ALTER", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { shadowWrite } = await loadShadowWrite();
    await shadowWrite("TRUNCATE users", [], "danger");
    await shadowWrite("DROP TABLE users", [], "danger");
    await shadowWrite("ALTER TABLE users ADD COLUMN x int", [], "danger");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });

  it("logs warning when proxy returns ok: false", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "syntax error", code: "42601" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { shadowWrite } = await loadShadowWrite();
    await shadowWrite("INSERT INTO users (id) VALUES ($1)", ["id-1"], "fail");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[shadow-write:fail]"));
  });
});

describe("isShadowWriteEnabled", () => {
  afterEach(() => {
    process.env = envBackup;
    vi.restoreAllMocks();
  });

  it("disabled when SHADOW_WRITE_ENABLED=0", async () => {
    process.env = { ...envBackup };
    process.env.PG_PROXY_URL = "https://proxy.example";
    process.env.PG_PROXY_TOKEN = "t";
    process.env.SHADOW_WRITE_ENABLED = "0";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { shadowWrite } = await loadShadowWrite();
    await shadowWrite("INSERT INTO t (id) VALUES (1)", [], "off");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
