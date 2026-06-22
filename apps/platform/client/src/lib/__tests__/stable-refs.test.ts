/**
 * @vitest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useStableArrayByIds, useStableSet } from "@/lib/stable-refs";

describe("stable-refs (441-fix2)", () => {
  it("useStableSet keeps same Set reference when array contents match", () => {
    const first = ["b", "a"];
    const second = ["a", "b"];
    const { result, rerender } = renderHook(({ ids }) => useStableSet(ids), {
      initialProps: { ids: first },
    });
    const initial = result.current;
    rerender({ ids: second });
    expect(result.current).toBe(initial);
    rerender({ ids: ["a", "b", "c"] });
    expect(result.current).not.toBe(initial);
  });

  it("useStableArrayByIds keeps same array reference when ids match regardless of order", () => {
    const rowA = { id: "a", name: "A" };
    const rowB = { id: "b", name: "B" };
    const { result, rerender } = renderHook(({ items }) => useStableArrayByIds(items), {
      initialProps: { items: [rowA, rowB] },
    });
    const initial = result.current;
    rerender({ items: [{ id: "b", name: "B2" }, { id: "a", name: "A2" }] });
    expect(result.current).toBe(initial);
    rerender({ items: [{ id: "a", name: "A2" }, { id: "c", name: "C" }] });
    expect(result.current).not.toBe(initial);
  });
});
