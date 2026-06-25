/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  encodeList,
  parseList,
  paramName,
  readStateFromParams,
  useCatalogFiltersUrl,
  writeStateToParams,
} from "@/hooks/use-catalog-filters-url";

let mockRouteQs = new URLSearchParams("dx_source=matrix");
let mockLoc = "/distribution";
const mockNavigateHashPathInHash = vi.fn();

vi.mock("@/lib/hash-location-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/hash-location-router")>();
  return {
    ...actual,
    useHashQuery: () => mockRouteQs,
    useHashLocation: () => [mockLoc, vi.fn()],
    navigateHashPathInHash: (...args: Parameters<typeof actual.navigateHashPathInHash>) =>
      mockNavigateHashPathInHash(...args),
  };
});

function applyNavigateHash(path: string): void {
  const qIdx = path.indexOf("?");
  mockLoc = qIdx >= 0 ? path.slice(0, qIdx) : path;
  mockRouteQs = qIdx >= 0 ? new URLSearchParams(path.slice(qIdx + 1)) : new URLSearchParams();
}

describe("use-catalog-filters-url helpers", () => {
  it("parses comma-separated URL values", () => {
    expect(parseList("vh,mk,hardware")).toEqual(["vh", "mk", "hardware"]);
    expect(parseList(null)).toEqual([]);
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

  it("prefix isolates parameters", () => {
    expect(paramName("dx", "cat")).toBe("dx_cat");
    expect(paramName(undefined, "cat")).toBe("cat");
  });

  it("writeStateToParams writes source=all explicitly", () => {
    const sp = writeStateToParams(new URLSearchParams(), "dx", ["brand"], {
      filters: { brand: ["A"] },
      query: "",
      source: "all",
      categories: [],
    });
    expect(sp.get("dx_source")).toBe("all");
    expect(sp.get("dx_brand")).toBe("A");
  });

  it("writeStateToParams writes source=matrix", () => {
    const sp = writeStateToParams(new URLSearchParams(), "dx", ["brand"], {
      filters: {},
      query: "",
      source: "matrix",
      categories: [],
    });
    expect(sp.get("dx_source")).toBe("matrix");
  });
});

describe("useCatalogFiltersUrl", () => {
  beforeEach(() => {
    mockRouteQs = new URLSearchParams("dx_source=matrix");
    mockLoc = "/distribution";
    mockNavigateHashPathInHash.mockReset();
    mockNavigateHashPathInHash.mockImplementation((path: string) => {
      applyNavigateHash(path);
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("setSource updates URL immediately (no debounce)", () => {
    const { result } = renderHook(() => useCatalogFiltersUrl({ prefix: "dx" }));

    act(() => {
      result.current.setSource("all");
    });

    expect(mockNavigateHashPathInHash).toHaveBeenCalledTimes(1);
    expect(mockRouteQs.get("dx_source")).toBe("all");
    expect(result.current.source).toBe("all");
  });

  it("preserves wizard hash params when setSource writes catalog filters", () => {
    mockRouteQs = new URLSearchParams("view=entry&ax=tradePoint&tp=manual-tp-1");
    mockLoc = "/distribution";

    const { result } = renderHook(() => useCatalogFiltersUrl({ prefix: "dx" }));

    act(() => {
      result.current.setSource("all");
    });

    expect(mockNavigateHashPathInHash).toHaveBeenCalledTimes(1);
    const target = mockNavigateHashPathInHash.mock.calls[0]?.[0] as string;
    expect(target).toContain("view=entry");
    expect(target).toContain("ax=tradePoint");
    expect(target).toContain("tp=manual-tp-1");
    expect(target).toContain("dx_source=all");
    expect(target.startsWith("/distribution?")).toBe(true);
  });

  it("setSource does not get overwritten by URL re-read within debounce window", async () => {
    const staleQs = new URLSearchParams("dx_source=matrix");
    mockRouteQs = staleQs;

    const { result, rerender } = renderHook(() => useCatalogFiltersUrl({ prefix: "dx" }));

    act(() => {
      result.current.setSource("all");
    });

    expect(result.current.source).toBe("all");

    mockRouteQs = staleQs;
    await act(async () => {
      rerender();
      await Promise.resolve();
    });

    expect(result.current.source).toBe("all");
  });

  it("setQuery still debounces URL updates", () => {
    const { result } = renderHook(() => useCatalogFiltersUrl({ prefix: "dx" }));

    act(() => {
      result.current.setQuery("lobby");
    });

    expect(mockNavigateHashPathInHash).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockNavigateHashPathInHash).toHaveBeenCalledTimes(1);
  });

  it("keeps local query during rapid typing until debounced URL write completes", () => {
    const { result, rerender } = renderHook(() => useCatalogFiltersUrl({ prefix: "dx" }));

    act(() => {
      result.current.setQuery("a");
      result.current.setQuery("ab");
      result.current.setQuery("abc");
    });

    expect(result.current.query).toBe("abc");
    expect(mockNavigateHashPathInHash).not.toHaveBeenCalled();

    mockRouteQs = new URLSearchParams("dx_source=matrix");
    act(() => {
      rerender();
    });

    expect(result.current.query).toBe("abc");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.query).toBe("abc");
    expect(mockRouteQs.get("dx_q")).toBe("abc");
  });
});
