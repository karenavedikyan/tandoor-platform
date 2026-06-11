import { describe, expect, it } from "vitest";
import {
  clientCodeFromDealerId,
  isDealerVisible,
  type ShowcaseVisibility,
} from "../showcase-matrix-handlers.js";

describe("showcase matrix visibility", () => {
  it("clientCodeFromDealerId maps dealer_id to client_code", () => {
    expect(clientCodeFromDealerId("client-ma-ma119856")).toBe("MA-MA119856");
  });

  it("isDealerVisible is always true for unrestricted", () => {
    const vis: ShowcaseVisibility = { unrestricted: true };
    expect(isDealerVisible(vis, "client-ma-ma119856")).toBe(true);
    expect(isDealerVisible(vis, "client-other")).toBe(true);
  });

  it("isDealerVisible respects visibleCodes set", () => {
    const vis: ShowcaseVisibility = {
      unrestricted: false,
      visibleCodes: new Set(["MA-MA119856"]),
    };
    expect(isDealerVisible(vis, "client-ma-ma119856")).toBe(true);
    expect(isDealerVisible(vis, "client-other-code")).toBe(false);
  });

  it("isDealerVisible is false when visibleCodes is empty", () => {
    const vis: ShowcaseVisibility = { unrestricted: false, visibleCodes: new Set() };
    expect(isDealerVisible(vis, "client-ma-ma119856")).toBe(false);
  });
});
