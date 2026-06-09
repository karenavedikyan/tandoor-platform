import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequestMock = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

import { fetchResolveClient, ResponsibilityApiError, type ResolvedResponsibles } from "../responsibility-api";

const SAMPLE_RESOLVED: ResolvedResponsibles = {
  manager: { userId: "m1", userName: "Менеджер", source: "legacy", sourceLevel: "client" },
  regional_manager: { userId: "rm1", userName: "Регионал", source: "legacy", sourceLevel: "client" },
  rop: { userId: "r1", userName: "Роп", source: "legacy", sourceLevel: "client" },
};

function mockJsonResponse(body: unknown): Response {
  return {
    json: async () => body,
  } as Response;
}

describe("fetchResolveClient", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("extracts resolved from tradePoints[0], sharedByRole and tradePointsCount", async () => {
    apiRequestMock.mockResolvedValue(
      mockJsonResponse({
        success: true,
        tradePoints: [{ tpId: "tp-1", name: "ТТ 1", city: "Москва", resolved: SAMPLE_RESOLVED }],
        sharedByRole: { manager: true },
      }),
    );

    const result = await fetchResolveClient("client-ma-ma124140");

    expect(apiRequestMock).toHaveBeenCalledWith(
      "GET",
      "/api/responsibility/client?dealerId=client-ma-ma124140",
    );
    expect(result.resolved).toEqual(SAMPLE_RESOLVED);
    expect(result.sharedByRole).toEqual({ manager: true });
    expect(result.tradePointsCount).toBe(1);
  });

  it("returns null resolved and zero count when client has no trade points", async () => {
    apiRequestMock.mockResolvedValue(
      mockJsonResponse({
        success: true,
        tradePoints: [],
        sharedByRole: {},
      }),
    );

    const result = await fetchResolveClient("client-empty");
    expect(result.resolved).toBeNull();
    expect(result.tradePointsCount).toBe(0);
  });

  it("throws ResponsibilityApiError when success is false", async () => {
    apiRequestMock.mockResolvedValue(
      mockJsonResponse({
        success: false,
        message: "Клиент не найден",
        code: "VALIDATION_ERROR",
      }),
    );

    await expect(fetchResolveClient("client-missing")).rejects.toMatchObject({
      name: "ResponsibilityApiError",
      message: "Клиент не найден",
      code: "VALIDATION_ERROR",
    } satisfies Partial<ResponsibilityApiError>);
  });
});
