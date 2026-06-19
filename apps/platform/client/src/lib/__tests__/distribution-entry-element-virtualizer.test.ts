import { describe, expect, it } from "vitest";
import { catalogCardGridClass } from "@/lib/catalog-card-grid";
import { catalogGridColumnsFromClass } from "@/lib/distribution-entry-element-virtualizer";

const COMPACT_M =
  "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7";
const NOT_COMPACT_M =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";
const COMPACT_S =
  "grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-12";

describe("catalogGridColumnsFromClass", () => {
  it("parses compact m grid across Tailwind breakpoints", () => {
    expect(catalogGridColumnsFromClass(COMPACT_M, 320)).toBe(3);
    expect(catalogGridColumnsFromClass(COMPACT_M, 700)).toBe(4);
    expect(catalogGridColumnsFromClass(COMPACT_M, 900)).toBe(5);
    expect(catalogGridColumnsFromClass(COMPACT_M, 1100)).toBe(6);
    expect(catalogGridColumnsFromClass(COMPACT_M, 1400)).toBe(7);
  });

  it("parses not-compact m grid across Tailwind breakpoints", () => {
    expect(catalogGridColumnsFromClass(NOT_COMPACT_M, 320)).toBe(2);
    expect(catalogGridColumnsFromClass(NOT_COMPACT_M, 700)).toBe(3);
    expect(catalogGridColumnsFromClass(NOT_COMPACT_M, 900)).toBe(4);
    expect(catalogGridColumnsFromClass(NOT_COMPACT_M, 1100)).toBe(5);
    expect(catalogGridColumnsFromClass(NOT_COMPACT_M, 1400)).toBe(6);
  });

  it("parses compact s grid at mobile and xl widths", () => {
    expect(catalogGridColumnsFromClass(COMPACT_S, 320)).toBe(4);
    expect(catalogGridColumnsFromClass(COMPACT_S, 1400)).toBe(12);
  });

  it("supports legacy min-[...] classes from catalogCardGridClass", () => {
    const gridClass = catalogCardGridClass("m");
    expect(catalogGridColumnsFromClass(gridClass, 320)).toBe(2);
    expect(catalogGridColumnsFromClass(gridClass, 700)).toBe(3);
    expect(catalogGridColumnsFromClass(gridClass, 900)).toBe(4);
  });

  it("returns 1 for empty grid class", () => {
    expect(catalogGridColumnsFromClass("", 1400)).toBe(1);
  });
});
