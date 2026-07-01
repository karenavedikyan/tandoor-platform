/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import {
  clientBaseOverviewCacheKey,
  getClientBaseOverviewCached,
  resetClientBaseOverviewCaches,
  setClientBaseOverviewCached,
  tradePointsOverviewCacheKey,
} from "../client-base-overview-cache.js";

describe("client-base-overview-cache", () => {
  it("stores and returns overview payload by scope key", () => {
    resetClientBaseOverviewCaches();
    const key = clientBaseOverviewCacheKey("director", "user-1", null, null);
    const payload = { success: true, structure: { activeClients: 3 } };
    setClientBaseOverviewCached(key, payload);
    expect(getClientBaseOverviewCached(key)).toEqual(payload);
    expect(tradePointsOverviewCacheKey("rop", "user-2")).toBe("rop:user-2");
  });
});
