import { describe, expect, it } from "vitest";
import {
  groupProperties,
  isHidden,
  pickShortProperties,
  visibleProperties,
  type GroupedProperty,
} from "./property-filters.js";

const SAMPLE: GroupedProperty[] = [
  { name: "СсылкаНаГлавную", value: "https://example.com" },
  { name: "сайт Тандор", value: "Да" },
  { name: "АкцияДействуетС_Тандор_ОПТ", value: "2024-01-01" },
  { name: "Главная", value: "Y" },
  { name: "Название для сайта", value: "Дверь X" },
  { name: "Покрытие", value: "Эмаль" },
  { name: "Толщина", value: "40 мм" },
  { name: "Цвет", value: "Белый" },
  { name: "Размер, мм", value: "860×2050" },
  { name: "Материал", value: "МДФ" },
  { name: "Гарантийный срок", value: "2 года" },
  { name: "Условия эксплуатации", value: "Внутри" },
  { name: "Количество в упаковке (шт)", value: "1" },
  { name: "Страна производитель", value: "Россия" },
  { name: "НП. Тип замка", value: "Магнитный" },
  { name: "Описание", value: "Длинное описание" },
  { name: "Артикул для маркетплейсов", value: "SKU-1" },
  { name: "Guid товара", value: "abc" },
];

describe("isHidden", () => {
  it("hides junk property names", () => {
    expect(isHidden("СсылкаНаГлавную")).toBe(true);
    expect(isHidden("АкцияДействуетС_Тандор_ОПТ")).toBe(true);
    expect(isHidden("сайт Тандор")).toBe(true);
    expect(isHidden("Главная")).toBe(true);
    expect(isHidden("Название для сайта")).toBe(true);
    expect(isHidden("Артикул для маркетплейсов")).toBe(true);
    expect(isHidden("Guid товара")).toBe(true);
  });

  it("keeps useful properties visible", () => {
    expect(isHidden("Покрытие")).toBe(false);
    expect(isHidden("Размер, мм")).toBe(false);
    expect(isHidden("Гарантийный срок")).toBe(false);
  });
});

describe("pickShortProperties", () => {
  it("prioritizes Покрытие and returns up to 3", () => {
    const short = pickShortProperties(SAMPLE);
    expect(short.length).toBeLessThanOrEqual(3);
    expect(short[0]?.name).toBe("Покрытие");
    expect(short.some((p) => p.name === "Толщина")).toBe(true);
    expect(short.some((p) => p.name === "СсылкаНаГлавную")).toBe(false);
  });
});

describe("groupProperties", () => {
  it("groups 30+ style set without hidden names", () => {
    const visible = visibleProperties(SAMPLE);
    expect(visible.some((p) => p.name === "СсылкаНаГлавную")).toBe(false);
    expect(visible.some((p) => p.name === "Описание")).toBe(false);

    const groups = groupProperties(SAMPLE);
    expect(groups.length).toBeGreaterThan(0);
    const titles = groups.map((g) => g.title);
    expect(titles).toContain("Материал и покрытие");
    expect(titles).toContain("Производитель и гарантия");

    const allNames = groups.flatMap((g) => g.properties.map((p) => p.name));
    expect(allNames).not.toContain("СсылкаНаГлавную");
    expect(allNames).not.toContain("сайт Тандор");

    for (const g of groups) {
      expect(g.properties.length).toBeGreaterThan(0);
    }
  });
});
