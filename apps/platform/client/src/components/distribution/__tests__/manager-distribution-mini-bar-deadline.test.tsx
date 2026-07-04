/**
 * @vitest-environment jsdom
 */
import { act as rtlAct, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ManagerDistributionMiniBar } from "../manager-distribution-mini-bar";
import { createEmptyActualizationState } from "@/lib/client-base-actualization-state";
import { LOADING_DEADLINE_MS } from "@/hooks/use-trade-point-distribution-aggregate";

const fetchShowcaseMatrixScopeMock = vi.hoisted(() => vi.fn());
const loadCachedMatrixMock = vi.hoisted(() => vi.fn(() => []));

vi.mock("@/lib/showcase-matrix-api", () => ({
  fetchShowcaseMatrixScope: fetchShowcaseMatrixScopeMock,
}));

vi.mock("@/lib/showcase-matrix-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/showcase-matrix-store")>();
  return {
    ...actual,
    loadCachedMatrix: loadCachedMatrixMock,
    SHOWCASE_MATRIX_STORE_CHANGED_EVENT: "showcase-matrix-store-changed",
  };
});

const actualization = createEmptyActualizationState();

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ManagerDistributionMiniBar loading deadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchShowcaseMatrixScopeMock.mockReset();
    loadCachedMatrixMock.mockReturnValue([]);
    fetchShowcaseMatrixScopeMock.mockImplementation(
      () =>
        new Promise(() => {
          /* never settles */
        }),
    );
  });

  it("renders empty bars instead of loader after deadline while prefetching", async () => {
    render(
      <ManagerDistributionMiniBar
        externalKeys={["tp-1"]}
        act={actualization}
        prefetching
        testId="mgr-dist"
      />,
    );

    expect(screen.getByTestId("mgr-dist-loading")).toBeTruthy();

    await rtlAct(async () => {
      await vi.advanceTimersByTimeAsync(LOADING_DEADLINE_MS);
    });

    expect(screen.queryByTestId("mgr-dist-loading")).toBeNull();
    expect(screen.getByTestId("mgr-dist")).toBeTruthy();
    expect(screen.getByText("ВХ")).toBeTruthy();
    expect(screen.getByText("Ротация")).toBeTruthy();
  });
});
