/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DistributionCardHeaderBlock } from "../distribution-card-header-block";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";

const managerDistributionMiniBarMock = vi.hoisted(() =>
  vi.fn(({ testId }: { testId?: string }) => (
    <div data-testid={testId ?? "manager-distribution-mini-bar-mock"} />
  )),
);

vi.mock("@/components/distribution/manager-distribution-mini-bar", () => ({
  ManagerDistributionMiniBar: managerDistributionMiniBarMock,
}));

const act = createEmptyActualizationState();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("dealer header distribution block", () => {
  it("renders mini-bar when externalKeys has two trade points", () => {
    const { getByTestId, getByText } = render(
      <DistributionCardHeaderBlock
        externalKeys={["tp-1", "tp-2"]}
        act={act}
        testId="dealer-header-distribution"
      />,
    );

    expect(getByText("Дистрибуция")).toBeTruthy();
    expect(getByTestId("dealer-header-distribution-wrap")).toBeTruthy();
    expect(getByTestId("dealer-header-distribution")).toBeTruthy();
    expect(managerDistributionMiniBarMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        externalKeys: ["tp-1", "tp-2"],
        act,
        prefetching: false,
        testId: "dealer-header-distribution",
      }),
    );
  });

  it("does not render when externalKeys is empty", () => {
    const { container } = render(
      <DistributionCardHeaderBlock
        externalKeys={[]}
        act={act}
        testId="dealer-header-distribution"
      />,
    );

    expect(container.firstChild).toBeNull();
    expect(managerDistributionMiniBarMock).not.toHaveBeenCalled();
  });
});
