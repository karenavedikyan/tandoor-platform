import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeForSearch } from "@/lib/entity-list-filtering";

describe("entity-list-filtering", () => {
  it("normalizeForSearch folds case and ё", () => {
    expect(normalizeForSearch("  Ёлка  ")).toBe("елка");
  });

  it("matchesSearch finds substring in any field", () => {
    expect(matchesSearch("топ 150", ["ООО Ромашка", "ТОП 150"])).toBe(true);
    expect(matchesSearch("xyz", ["Альфа"])).toBe(false);
  });

  it("matchesSearch passes when query empty", () => {
    expect(matchesSearch("", ["anything"])).toBe(true);
  });
});
