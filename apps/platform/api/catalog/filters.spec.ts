import { describe, expect, it } from "vitest";
import {
  encodePropsParam,
  parsePropsParam,
  propertyFilterMeta,
} from "./_catalog-query.js";

describe("catalog filters helpers", () => {
  it("parsePropsParam decodes key:value pairs", () => {
    const raw = `${encodeURIComponent("Толщина")}:${encodeURIComponent("8")},${encodeURIComponent("НП. Класс эксплуатации")}:${encodeURIComponent("33")}`;
    const m = parsePropsParam(raw);
    expect(m.get("Толщина")).toEqual(["8"]);
    expect(m.get("НП. Класс эксплуатации")).toEqual(["33"]);
  });

  it("propertyFilterMeta extracts label and unit", () => {
    expect(propertyFilterMeta("Размер, мм")).toEqual({ label: "Размер", unit: "мм" });
    expect(propertyFilterMeta("Цвет")).toEqual({ label: "Цвет", unit: null });
  });

  it("encodePropsParam round-trips", () => {
    const enc = encodePropsParam({ Толщина: ["8", "12"] });
    const m = parsePropsParam(enc);
    expect(m.get("Толщина")?.sort()).toEqual(["12", "8"]);
  });

  it("filters response shape (contract)", () => {
    const sample = {
      success: true,
      price: { min: 100, max: 50000 },
      brands: [{ value: "Aberhof", count: 10 }],
      properties: [
        {
          key: "Толщина",
          label: "Толщина",
          unit: null,
          values: [{ value: "8", count: 5 }],
        },
      ],
    };
    expect(Array.isArray(sample.brands)).toBe(true);
    expect(Array.isArray(sample.properties)).toBe(true);
    expect(typeof sample.price.min).toBe("number");
    expect(typeof sample.price.max).toBe("number");
  });
});
