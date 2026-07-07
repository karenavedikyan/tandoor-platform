/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OneCListDensityToggle } from "../one-c-list-density-toggle";
import { migrateOneCListDensityValue, readOneCListDensity } from "../use-one-c-list-density";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("OneCListDensityToggle", () => {
  it("persists selected density in localStorage via parent handler", () => {
    let density: "large" | "grid" | "list" | "table" = "grid";
    const onChange = (next: typeof density) => {
      density = next;
      localStorage.setItem("one-c-list-view:stores", next);
    };

    const { rerender } = render(
      <OneCListDensityToggle value={density} onChange={onChange} testIdPrefix="one-c-stores" />,
    );

    fireEvent.click(screen.getByTestId("button-one-c-density-table"));
    expect(density).toBe("table");
    expect(readOneCListDensity("stores")).toBe("table");

    rerender(<OneCListDensityToggle value={density} onChange={onChange} testIdPrefix="one-c-stores" />);
    fireEvent.click(screen.getByTestId("button-one-c-density-large"));
    expect(readOneCListDensity("stores")).toBe("large");
  });
});

describe("migrateOneCListDensityValue", () => {
  it("migrates legacy cards value to grid", () => {
    expect(migrateOneCListDensityValue("cards")).toBe("grid");
    expect(migrateOneCListDensityValue("table")).toBe("table");
    expect(migrateOneCListDensityValue("legacy")).toBeNull();
  });
});
