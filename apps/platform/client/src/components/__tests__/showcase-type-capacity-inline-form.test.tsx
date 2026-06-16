/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { ShowcaseTypeCapacityInlineForm } from "../showcase-type-capacity-inline-form";

afterEach(() => {
  cleanup();
});

describe("ShowcaseTypeCapacityInlineForm", () => {
  it("renders interior-specific title", () => {
    const { getByTestId, container } = render(
      <ShowcaseTypeCapacityInlineForm
        type="interior"
        currentCapacity={null}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container.textContent).toContain("Сколько витрин для межкомнатных дверей в этой ТТ?");
    expect(getByTestId("form-showcase-type-capacity-interior")).toBeTruthy();
  });

  it("rejects non-integer values", () => {
    const onSave = vi.fn();
    const { getByTestId } = render(
      <ShowcaseTypeCapacityInlineForm
        type="entrance"
        currentCapacity={null}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    const input = getByTestId("input-showcase-type-capacity-entrance") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2.5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSave).not.toHaveBeenCalled();
    expect(getByTestId("text-showcase-type-capacity-error-entrance").textContent).toContain("целое число");
  });

  it("saves integer value", () => {
    const onSave = vi.fn();
    const { getByTestId } = render(
      <ShowcaseTypeCapacityInlineForm
        type="hardware"
        currentCapacity={null}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    const input = getByTestId("input-showcase-type-capacity-hardware") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "4" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSave).toHaveBeenCalledWith(4);
  });
});
