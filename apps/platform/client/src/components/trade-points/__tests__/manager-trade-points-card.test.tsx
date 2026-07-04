/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ManagerTradePointsCard } from "../manager-trade-points-card";
import type { ManagerTradePointsCardModel } from "../manager-trade-points-card";

const baseManager: ManagerTradePointsCardModel = {
  userId: "mgr-1",
  fullName: "Менеджер",
  tradePoints: 10,
  clientsWithTp: 8,
  cities: 2,
  withoutPhoto: 0,
  notFilled: 0,
  segments: [],
  shellHref: "#/dealer-base/manager/mgr-1",
};

afterEach(() => {
  cleanup();
});

describe("ManagerTradePointsCard", () => {
  it("renders disabled open-hq button without link when shellHref is empty", () => {
    render(
      <ManagerTradePointsCard
        manager={{ ...baseManager, userId: "", fullName: "Без менеджера", shellHref: "" }}
        heatLevel="medium"
      />,
    );
    const button = screen.getByTestId("button-manager-tp-open-hq-");
    expect(button.tagName).toBe("BUTTON");
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.closest("a")).toBeNull();
  });

  it("renders linked open-hq button when shellHref is set", () => {
    render(<ManagerTradePointsCard manager={baseManager} heatLevel="medium" />);
    const link = screen.getByTestId("button-manager-tp-open-hq-mgr-1");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("#/dealer-base/manager/mgr-1");
  });
});
