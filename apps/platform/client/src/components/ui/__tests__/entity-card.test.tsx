/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EntityCard, EntityCardEscape } from "../entity-card";

describe("EntityCard", () => {
  it("renders as link to href", () => {
    render(<EntityCard href="/dealers/x">content</EntityCard>);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toContain("/dealers/x");
  });

  it("EntityCardEscape stops propagation and calls onActivate", () => {
    const onActivate = vi.fn();
    const onCardClick = vi.fn();
    render(
      <div onClick={onCardClick}>
        <EntityCardEscape onActivate={onActivate}>escape</EntityCardEscape>
      </div>,
    );
    fireEvent.click(screen.getByText("escape"));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
