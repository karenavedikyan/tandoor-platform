/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ShowcaseCapacityAutogrowNoticeDialog } from "../showcase-capacity-autogrow-notice-dialog";

const grownTypes = [
  { type: "entrance" as const, oldCapacity: 7, nextCapacity: 14, markedCount: 14 },
  { type: "interior" as const, oldCapacity: 2, nextCapacity: 11, markedCount: 11 },
];

describe("ShowcaseCapacityAutogrowNoticeDialog", () => {
  it("renders grown types and action buttons", () => {
    const onAcknowledge = vi.fn();
    const onEditManually = vi.fn();
    const { getByTestId, getByText } = render(
      <ShowcaseCapacityAutogrowNoticeDialog
        open
        grownTypes={grownTypes}
        onAcknowledge={onAcknowledge}
        onEditManually={onEditManually}
      />,
    );

    expect(getByTestId("dialog-showcase-capacity-autogrow-notice")).toBeTruthy();
    expect(getByTestId("showcase-capacity-autogrow-row-entrance").textContent).toContain("было 7");
    expect(getByTestId("showcase-capacity-autogrow-row-interior").textContent).toContain("было 2");
    expect(getByText("Ёмкость витрины увеличена автоматически")).toBeTruthy();

    fireEvent.click(getByTestId("button-showcase-capacity-autogrow-edit"));
    expect(onEditManually).toHaveBeenCalledTimes(1);
  });
});
