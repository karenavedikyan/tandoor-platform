/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogFiltersPanel } from "../CatalogFiltersPanel";

afterEach(() => cleanup());

describe("CatalogFiltersPanel", () => {
  it("renders categories and facets with counts", () => {
    render(
      <CatalogFiltersPanel
        categories={[
          { id: "vh", label: "ВХ", count: 10 },
          { id: "mk", label: "МК", count: 5 },
        ]}
        selectedCategories={[]}
        onCategoriesChange={() => {}}
        facets={[
          {
            key: "brand",
            label: "Бренд",
            options: [
              { value: "Tandoor", count: 3 },
              { value: "Other", count: 2 },
            ],
          },
        ]}
        value={{}}
        onChange={() => {}}
        onResetAll={() => {}}
      />,
    );

    expect(screen.getByTestId("catalog-filters-category-vh").textContent).toContain("ВХ (10)");
    expect(screen.getByText(/Tandoor/)).toBeTruthy();
  });

  it("calls onCategoriesChange when category chip clicked", () => {
    const onCategoriesChange = vi.fn();
    render(
      <CatalogFiltersPanel
        categories={[{ id: "vh", label: "ВХ" }]}
        selectedCategories={[]}
        onCategoriesChange={onCategoriesChange}
        facets={[]}
        value={{}}
        onChange={() => {}}
        onResetAll={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId("catalog-filters-category-vh"));
    expect(onCategoriesChange).toHaveBeenCalledWith(["vh"]);
  });

  it("calls onChange when facet checkbox toggled", () => {
    const onChange = vi.fn();
    render(
      <CatalogFiltersPanel
        selectedCategories={[]}
        onCategoriesChange={() => {}}
        facets={[
          {
            key: "brand",
            label: "Бренд",
            options: [{ value: "Tandoor", count: 1 }],
          },
        ]}
        value={{}}
        onChange={onChange}
        onResetAll={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /Tandoor/ }));
    expect(onChange).toHaveBeenCalledWith("brand", ["Tandoor"]);
  });

  it("shows reset button only when activeCount > 0", () => {
    const { rerender } = render(
      <CatalogFiltersPanel
        selectedCategories={[]}
        onCategoriesChange={() => {}}
        facets={[]}
        value={{}}
        onChange={() => {}}
        onResetAll={() => {}}
        activeCount={0}
      />,
    );
    expect(screen.queryByTestId("catalog-filters-reset-all")).toBeNull();

    rerender(
      <CatalogFiltersPanel
        selectedCategories={["vh"]}
        onCategoriesChange={() => {}}
        facets={[]}
        value={{}}
        onChange={() => {}}
        onResetAll={() => {}}
        activeCount={1}
      />,
    );
    expect(screen.getByTestId("catalog-filters-reset-all")).toBeTruthy();
  });
});
