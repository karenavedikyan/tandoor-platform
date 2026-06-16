/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { AnalyticsModelPicker } from "../analytics-model-picker";
import type { CatalogProduct } from "@/lib/catalog-product-type";

function makeProduct(id: string, overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id,
    name: `Модель ${id}`,
    article: `ART-${id}`,
    category: "Двери",
    series: "Тест-серия",
    type: "entrance",
    doorKind: "Входная",
    status: "",
    image: null,
    shortDescription: "",
    description: "",
    features: [],
    specs: [],
    equipment: [],
    variants: [],
    colors: [],
    sizes: [],
    manufacturer: "",
    warranty: "",
    coating: "",
    openType: "",
    isTop: false,
    isNew: false,
    isExclusive: false,
    isAction: false,
    inStock: true,
    showcasePriority: 0,
    salesPriority: 0,
    recommendedForShowcase: false,
    relatedDealerIds: [],
    relatedTradePointIds: [],
    relatedTaskCount: 0,
    history: [],
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("AnalyticsModelPicker", () => {
  it("filters by query (name)", () => {
    const products = [makeProduct("1", { name: "Альфа" }), makeProduct("2", { name: "Бета" })];
    const onChange = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <AnalyticsModelPicker products={products} activeEquipmentTypes={[]} value={[]} onChange={onChange} />,
    );
    const input = getByTestId("analytics-model-picker-search") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "альф" } });
    expect(getByTestId("analytics-model-card-1")).toBeTruthy();
    expect(queryByTestId("analytics-model-card-2")).toBeNull();
  });

  it("toggles selection on click", () => {
    const products = [makeProduct("1")];
    const onChange = vi.fn();
    const { getByTestId } = render(
      <AnalyticsModelPicker products={products} activeEquipmentTypes={[]} value={[]} onChange={onChange} />,
    );
    fireEvent.click(getByTestId("analytics-model-card-1"));
    expect(onChange).toHaveBeenCalledWith(["1"]);
  });

  it("removes selection on second click", () => {
    const products = [makeProduct("1")];
    const onChange = vi.fn();
    const { getByTestId } = render(
      <AnalyticsModelPicker products={products} activeEquipmentTypes={[]} value={["1"]} onChange={onChange} />,
    );
    fireEvent.click(getByTestId("analytics-model-card-1"));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
