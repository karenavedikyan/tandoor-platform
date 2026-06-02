import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTER_GROUPS,
  FILTERS_BY_ROOT_CATEGORY,
  ROOT_CATEGORY_IDS,
  getFilterGroupsForRoot,
} from "./_filter-config.js";
import { buildGroupFilterClause } from "./_filter-build.js";
import {
  collapsePropertyValues,
  isJunkPropertyValue,
  normalizeValueKey,
  parseNumericPropertyValue,
  valueMatchesBucket,
} from "./_filter-values.js";
import { LEAF_THICKNESS_BUCKETS, STEEL_THICKNESS_BUCKETS } from "./_filter-config.js";

describe("contextual filter config", () => {
  it("interior category has design/color/material/door kind groups", () => {
    const groups = getFilterGroupsForRoot(ROOT_CATEGORY_IDS.INTERIOR, "Межкомнатные двери");
    const keys = groups.map((g) => g.key);
    expect(keys).toContain("Дизайн");
    expect(keys).toContain("Цветовая гамма");
    expect(keys).toContain("Материал\\Покрытие");
    expect(keys).toContain("Вид двери");
    expect(keys).not.toContain("Толщина стали, мм");
    expect(keys).not.toContain("Терморазрыв");
  });

  it("entrance category has placement, door kind, thickness buckets", () => {
    const groups = getFilterGroupsForRoot(ROOT_CATEGORY_IDS.ENTRANCE, "Входные двери");
    const keys = groups.map((g) => g.key);
    expect(keys).toContain("Место назначения");
    expect(keys).toContain("Вид двери");
    expect(keys).toContain("Толщина полотна, мм");
    expect(keys).toContain("Толщина стали, мм");
    expect(keys).not.toContain("Дизайн");
  });

  it("plinth has material and color", () => {
    const groups = getFilterGroupsForRoot(ROOT_CATEGORY_IDS.PLINTH, "Плинтус напольный");
    expect(groups.map((g) => g.key)).toEqual(["Материал", "Цвет"]);
  });

  it("hardware has handle groups", () => {
    const groups = getFilterGroupsForRoot(ROOT_CATEGORY_IDS.HARDWARE, "Фурнитура");
    const keys = groups.map((g) => g.key);
    expect(keys).toContain("Вид ручки");
    expect(keys).toContain("Основание ручки");
    expect(keys).toContain("Тип установки");
    expect(keys).toContain("Высота петли");
  });

  it("flooring returns no filter groups", () => {
    expect(getFilterGroupsForRoot(ROOT_CATEGORY_IDS.FLOORING, "Напольные покрытия")).toEqual([]);
  });

  it("all sections uses default brand and color", () => {
    expect(getFilterGroupsForRoot(null, null)).toEqual(DEFAULT_FILTER_GROUPS);
  });

  it("resolves by category name when id unknown", () => {
    const groups = getFilterGroupsForRoot("unknown-id", "Межкомнатные двери");
    expect(groups.some((g) => g.key === "Дизайн")).toBe(true);
  });
});

describe("filter value hygiene", () => {
  it("rejects values longer than 60 chars", () => {
    expect(isJunkPropertyValue("x".repeat(61))).toBe(true);
    expect(isJunkPropertyValue("короткое")).toBe(false);
  });

  it("rejects GUID-like values", () => {
    expect(isJunkPropertyValue("cf1d70a8-85ad-11ed-8126-00155d0a0a4e")).toBe(true);
    expect(isJunkPropertyValue("#a243849d-85ad-11ed-8126-00155d0a0a4e")).toBe(true);
  });

  it("rejects blacklisted property names via isJunk on any value", () => {
    expect(isJunkPropertyValue("любой текст", "Условия эксплуатации")).toBe(true);
    expect(isJunkPropertyValue("guid-here", "Комплектующие")).toBe(true);
  });

  it("collapses black/черный and dark variants", () => {
    const collapsed = collapsePropertyValues([
      { value: "Черный", count: 70 },
      { value: "черный", count: 66 },
      { value: "Тёмная", count: 125 },
      { value: "Темная", count: 38 },
    ]);
    expect(collapsed).toHaveLength(2);
    const black = collapsed.find((c) => c.normKey === "черный");
    expect(black?.count).toBe(136);
    const dark = collapsed.find((c) => c.normKey === "темная");
    expect(dark?.count).toBe(163);
  });
});

describe("thickness buckets", () => {
  it("maps 95mm to 90-99 bucket", () => {
    const bucket = LEAF_THICKNESS_BUCKETS.find((b) => b.label === "от 90 до 99 мм")!;
    expect(valueMatchesBucket(95, bucket)).toBe(true);
    expect(valueMatchesBucket(69, bucket)).toBe(false);
  });

  it("parses numeric property with comma decimal", () => {
    expect(parseNumericPropertyValue("1,5")).toBe(1.5);
    expect(parseNumericPropertyValue("100 мм")).toBe(100);
  });

  it("steel buckets cover 1.2 in 1-1.49 range", () => {
    const bucket = STEEL_THICKNESS_BUCKETS.find((b) => b.label === "от 1 до 1,49 мм")!;
    expect(valueMatchesBucket(1.2, bucket)).toBe(true);
  });
});

describe("buildGroupFilterClause", () => {
  it("builds normalized checkbox clause for interior design", () => {
    const defs = FILTERS_BY_ROOT_CATEGORY[ROOT_CATEGORY_IDS.INTERIOR]!;
    const params: unknown[] = [];
    const sql = buildGroupFilterClause("Дизайн", ["Классика"], defs, params)!;
    expect(sql).toContain("LOWER(REPLACE(REPLACE(TRIM(pp.value)");
    expect(sql).toContain("ANY");
    expect(params.length).toBe(2);
  });
});
