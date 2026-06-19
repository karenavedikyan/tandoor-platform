import { describe, it, expect, beforeEach } from "vitest";
import { runSchemaVersionHandshake } from "../schema-version-handshake";
import { SCHEMA_VERSION, SCHEMA_VERSION_STORAGE_KEY } from "../schema-version";

describe("runSchemaVersionHandshake", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("no-op когда версия совпадает", () => {
    window.localStorage.setItem(SCHEMA_VERSION_STORAGE_KEY, String(SCHEMA_VERSION));
    window.localStorage.setItem("tandoor-some-key", "x");
    const r = runSchemaVersionHandshake();
    expect(r.wiped).toBe(false);
    expect(window.localStorage.getItem("tandoor-some-key")).toBe("x");
  });

  it("сносит tandoor-* и actualization-* при mismatch", () => {
    window.localStorage.setItem(SCHEMA_VERSION_STORAGE_KEY, "0");
    window.localStorage.setItem("tandoor-dealer-base-view-mode-v1", "grid");
    window.localStorage.setItem("actualization-race", "{}");
    window.localStorage.setItem("dealer-base-rows", "[]");
    window.localStorage.setItem("roleScopedDealerRows", "[]");
    window.localStorage.setItem("user-totally-custom-thing", "keep-me");
    const r = runSchemaVersionHandshake();
    expect(r.wiped).toBe(true);
    expect(r.removedCount).toBeGreaterThanOrEqual(4);
    expect(window.localStorage.getItem("tandoor-dealer-base-view-mode-v1")).toBeNull();
    expect(window.localStorage.getItem("actualization-race")).toBeNull();
    expect(window.localStorage.getItem("dealer-base-rows")).toBeNull();
    expect(window.localStorage.getItem("roleScopedDealerRows")).toBeNull();
    // не-tandoor ключ не трогаем
    expect(window.localStorage.getItem("user-totally-custom-thing")).toBe("keep-me");
    // новая версия записана
    expect(window.localStorage.getItem(SCHEMA_VERSION_STORAGE_KEY)).toBe(String(SCHEMA_VERSION));
  });

  it("делает wipe при пустом маркере, если есть tandoor-данные", () => {
    window.localStorage.setItem("tandoor-anything", "x");
    const r = runSchemaVersionHandshake();
    expect(r.wiped).toBe(true);
    expect(window.localStorage.getItem("tandoor-anything")).toBeNull();
  });
});
