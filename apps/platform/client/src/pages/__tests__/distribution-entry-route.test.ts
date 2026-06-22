import { describe, expect, it } from "vitest";
import { parseEntryAxis } from "@/pages/distribution";

describe("parseEntryAxis", () => {
  it("returns valid axis values from hash query", () => {
    expect(parseEntryAxis(new URLSearchParams("ax=tradePoint"))).toBe("tradePoint");
    expect(parseEntryAxis(new URLSearchParams("ax=product"))).toBe("product");
    expect(parseEntryAxis(new URLSearchParams("ax=city"))).toBe("city");
  });

  it("returns null for missing, empty, or invalid ax", () => {
    expect(parseEntryAxis(new URLSearchParams(""))).toBeNull();
    expect(parseEntryAxis(new URLSearchParams("ax="))).toBeNull();
    expect(parseEntryAxis(new URLSearchParams("ax=invalid"))).toBeNull();
    expect(parseEntryAxis(new URLSearchParams("ax=tradePoint&tp=tp-1"))).toBe("tradePoint");
  });
});
