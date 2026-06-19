/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildHashWithQuery,
  getHashQueryString,
  stripQuery,
  useHashLocation,
  useHashQuery,
} from "@/lib/hash-location-router";

const mockSetRawLoc = vi.fn();
let mockRawLoc = "/distribution";

vi.mock("wouter/use-hash-location", () => ({
  useHashLocation: () => [mockRawLoc, mockSetRawLoc],
}));

describe("hash-location-router helpers", () => {
  it("stripQuery removes query from path", () => {
    expect(stripQuery("/distribution?de_axis=tradePoint")).toBe("/distribution");
    expect(stripQuery("/distribution")).toBe("/distribution");
    expect(stripQuery("")).toBe("");
  });

  it("getHashQueryString reads query from window.location.hash", () => {
    window.location.hash = "#/distribution?de_axis=tradePoint";
    expect(getHashQueryString()).toBe("de_axis=tradePoint");

    window.location.hash = "#/distribution";
    expect(getHashQueryString()).toBe("");

    window.location.hash = "";
    expect(getHashQueryString()).toBe("");
  });

  it("buildHashWithQuery builds path with query params", () => {
    expect(buildHashWithQuery("/distribution", { de_axis: "tradePoint" })).toBe(
      "/distribution?de_axis=tradePoint",
    );
    expect(buildHashWithQuery("/distribution", {})).toBe("/distribution");
    expect(buildHashWithQuery("/distribution", { de_axis: undefined })).toBe("/distribution");
    expect(
      buildHashWithQuery("/distribution", { de_axis: "tradePoint", de_tp: "tp-1" }),
    ).toBe("/distribution?de_axis=tradePoint&de_tp=tp-1");
  });
});

describe("useHashLocation", () => {
  afterEach(() => {
    mockRawLoc = "/distribution";
    mockSetRawLoc.mockReset();
  });

  it("returns path without query for Route matching", () => {
    mockRawLoc = "/distribution?de_axis=tradePoint";
    const { result } = renderHook(() => useHashLocation());
    expect(result.current[0]).toBe("/distribution");
  });

  it("forwards navigation with query to underlying hash location", () => {
    const { result } = renderHook(() => useHashLocation());
    act(() => {
      result.current[1]("/distribution?de_axis=product");
    });
    expect(mockSetRawLoc).toHaveBeenCalledWith("/distribution?de_axis=product");
  });
});

describe("useHashQuery", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("reacts to hashchange and returns updated params", () => {
    window.location.hash = "#/distribution?de_axis=tradePoint";
    const { result } = renderHook(() => useHashQuery());
    expect(result.current.get("de_axis")).toBe("tradePoint");

    act(() => {
      window.location.hash = "#/distribution?de_axis=product";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(result.current.get("de_axis")).toBe("product");
  });
});
