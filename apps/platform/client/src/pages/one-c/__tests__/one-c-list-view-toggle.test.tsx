/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OneCListViewToggle } from "../one-c-list-view-toggle";
import { readOneCListView } from "../use-one-c-list-view";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("OneCListViewToggle", () => {
  it("persists selected view in localStorage via parent handler", () => {
    let view: "cards" | "table" = "cards";
    const onChange = (next: "cards" | "table") => {
      view = next;
      localStorage.setItem("one-c-list-view:stores", next);
    };

    const { rerender } = render(
      <OneCListViewToggle value={view} onChange={onChange} testIdPrefix="one-c-stores" />,
    );

    fireEvent.click(screen.getByTestId("one-c-stores-view-table"));
    expect(view).toBe("table");
    expect(readOneCListView("stores")).toBe("table");

    rerender(<OneCListViewToggle value={view} onChange={onChange} testIdPrefix="one-c-stores" />);
    fireEvent.click(screen.getByTestId("one-c-stores-view-cards"));
    expect(readOneCListView("stores")).toBe("cards");
  });
});
