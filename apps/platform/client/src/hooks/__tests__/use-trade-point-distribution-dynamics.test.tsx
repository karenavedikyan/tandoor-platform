/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { useTradePointDistributionDynamics } from "@/hooks/use-trade-point-distribution-dynamics";

function Probe({
  tradePointIds,
  periodDays,
}: {
  tradePointIds: string[];
  periodDays: 7 | 30 | 90;
}) {
  const { loading, deltaByType } = useTradePointDistributionDynamics(tradePointIds, periodDays);
  return (
    <div>
      <span data-testid="loading">{loading ? "1" : "0"}</span>
      <span data-testid="entrance-delta">{deltaByType.entrance ?? "null"}</span>
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useTradePointDistributionDynamics", () => {
  it("does not fetch for empty trade point list and keeps null deltas", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { getByTestId } = render(<Probe tradePointIds={[]} periodDays={30} />);
    expect(getByTestId("entrance-delta").textContent).toBe("null");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps snapshot-range response to deltaByType", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          currentByTradePointId: {
            "tp-1": {
              entrance: { capacity: 10, onShelf: 5 },
              interior: { capacity: 0, onShelf: 0 },
              hardware: { capacity: 0, onShelf: 0 },
            },
          },
          baselineByTradePointId: {
            "tp-1": {
              entrance: { capacity: 10, onShelf: 4 },
              interior: { capacity: 0, onShelf: 0 },
              hardware: { capacity: 0, onShelf: 0 },
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const { getByTestId } = render(<Probe tradePointIds={["tp-1"]} periodDays={30} />);
    await waitFor(() => expect(getByTestId("loading").textContent).toBe("0"));
    expect(getByTestId("entrance-delta").textContent).toBe("10");
  });
});
