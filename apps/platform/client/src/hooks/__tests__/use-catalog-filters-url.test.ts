import { describe, expect, it } from "vitest";
import {
  encodeList,
  parseList,
  paramName,
  readStateFromParams,
  writeStateToParams,
} from "@/hooks/use-catalog-filters-url";

describe("use-catalog-filters-url helpers", () => {
  it("parses comma-separated URL values", () => {
    expect(parseList("vh,mk,hardware")).toEqual(["vh", "mk", "hardware"]);
    expect(parseList(null)).toEqual([]);
  });

  it("encodes list for URL", () => {
    expect(encodeList(["a", "b"])).toBe("a,b");
    expect(encodeList([])).toBeUndefined();
  });

  it("reads filters from URLSearchParams", () => {
    const sp = new URLSearchParams("dx_cat=vh,mk&dx_brand=Tandoor&dx_q=lobby&dx_source=matrix");
    const state = readStateFromParams(sp, "dx", ["brand", "series"]);
    expect(state.categories).toEqual(["vh", "mk"]);
    expect(state.filters.brand).toEqual(["Tandoor"]);
    expect(state.query).toBe("lobby");
    expect(state.source).toBe("matrix");
  });

  it("omits source=all from written URL", () => {
    const sp = writeStateToParams(new URLSearchParams(), "dx", ["brand"], {
      filters: { brand: ["A"] },
      query: "",
      source: "all",
      categories: [],
    });
    expect(sp.get("dx_source")).toBeNull();
    expect(sp.get("dx_brand")).toBe("A");
  });

  it("prefix isolates parameters", () => {
    expect(paramName("dx", "cat")).toBe("dx_cat");
    expect(paramName(undefined, "cat")).toBe("cat");
  });
});
