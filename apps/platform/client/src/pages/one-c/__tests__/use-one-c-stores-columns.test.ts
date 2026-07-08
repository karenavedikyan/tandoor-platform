import { describe, expect, it } from "vitest";
import {
  DEFAULT_STORE_COLUMNS,
  mergeStoreColumnsState,
  parseStoreColumnsState,
  reorderStoreColumns,
  toggleStoreColumn,
  visibleStoreColumns,
} from "../one-c-stores-columns";

describe("one-c stores columns", () => {
  it("returns default columns when storage is empty", () => {
    expect(mergeStoreColumnsState(null)).toEqual(DEFAULT_STORE_COLUMNS);
  });

  it("merges saved order and appends new keys as visible", () => {
    const saved = [
      { key: "manager" as const, visible: true },
      { key: "address" as const, visible: false },
    ];
    const merged = mergeStoreColumnsState(saved);
    expect(merged[0]?.key).toBe("manager");
    expect(merged[1]?.key).toBe("address");
    expect(merged[1]?.visible).toBe(false);
    expect(merged.some((c) => c.key === "holding")).toBe(true);
    expect(merged.some((c) => c.key === "contact" && c.visible)).toBe(true);
    expect(merged).toHaveLength(DEFAULT_STORE_COLUMNS.length);
  });

  it("toggles column visibility", () => {
    const next = toggleStoreColumn(DEFAULT_STORE_COLUMNS, "holding");
    expect(next.find((c) => c.key === "holding")?.visible).toBe(false);
    expect(toggleStoreColumn(next, "holding").find((c) => c.key === "holding")?.visible).toBe(true);
  });

  it("reorders columns", () => {
    const reordered = reorderStoreColumns(DEFAULT_STORE_COLUMNS, 0, 2);
    expect(reordered[0]?.key).toBe("address");
    expect(reordered[2]?.key).toBe("holding");
  });

  it("ignores invalid reorder indices", () => {
    expect(reorderStoreColumns(DEFAULT_STORE_COLUMNS, -1, 2)).toEqual(DEFAULT_STORE_COLUMNS);
    expect(reorderStoreColumns(DEFAULT_STORE_COLUMNS, 0, 99)).toEqual(DEFAULT_STORE_COLUMNS);
  });

  it("filters visible columns", () => {
    const visible = visibleStoreColumns(DEFAULT_STORE_COLUMNS);
    expect(visible.map((c) => c.key)).toEqual([
      "holding",
      "address",
      "legal_name",
      "contact",
      "fill",
      "vh",
      "mk",
      "hw",
      "rot",
      "manager",
    ]);
  });

  it("parses valid localStorage JSON", () => {
    const parsed = parseStoreColumnsState(
      JSON.stringify([
        { key: "address", visible: true },
        { key: "bogus", visible: true },
      ]),
    );
    expect(parsed).toEqual([{ key: "address", visible: true }]);
  });

  it("returns null for invalid JSON", () => {
    expect(parseStoreColumnsState("{bad")).toBeNull();
  });
});
