import { afterEach, describe, expect, it } from "vitest";
import {
  diffScopeSets,
  isShadowReadEnabled,
  legacyReleaseCodesToExternalKeys,
} from "../effective-scope-shadow.js";

const ENV_KEY = "READ_FROM_EFFECTIVE_SCOPE_SHADOW";

describe("effective-scope-shadow", () => {
  const prev = process.env[ENV_KEY];

  afterEach(() => {
    if (prev === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = prev;
  });

  it("isShadowReadEnabled honors env", () => {
    delete process.env[ENV_KEY];
    expect(isShadowReadEnabled()).toBe(false);
    process.env[ENV_KEY] = "1";
    expect(isShadowReadEnabled()).toBe(true);
    process.env[ENV_KEY] = "true";
    expect(isShadowReadEnabled()).toBe(true);
    process.env[ENV_KEY] = "off";
    expect(isShadowReadEnabled()).toBe(false);
  });

  it("legacyReleaseCodesToExternalKeys normalizes release_code", () => {
    const keys = legacyReleaseCodesToExternalKeys(["MA-MA085529", "MA0000079"]);
    expect(keys.has("client-ma-ma085529")).toBe(true);
    expect(keys.has("client-ma0000079")).toBe(true);
  });

  it("diffScopeSets detects symmetric difference", () => {
    const d = diffScopeSets(["a", "b", "c"], ["b", "c", "d"]);
    expect(d.legacy_count).toBe(3);
    expect(d.shadow_count).toBe(3);
    expect(d.missing_in_shadow).toEqual(["a"]);
    expect(d.extra_in_shadow).toEqual(["d"]);
  });

  it("diffScopeSets returns empty when equal", () => {
    const d = diffScopeSets(["a", "b"], ["b", "a"]);
    expect(d.missing_in_shadow).toEqual([]);
    expect(d.extra_in_shadow).toEqual([]);
  });

  it("diffScopeSets limits samples", () => {
    const big = Array.from({ length: 100 }, (_, i) => `k${i}`);
    const d = diffScopeSets(big, [], 10);
    expect(d.missing_in_shadow.length).toBe(10);
  });
});
