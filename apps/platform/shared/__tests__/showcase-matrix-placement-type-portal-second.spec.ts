import { describe, expect, it } from "vitest";
import {
  parseShowcaseMatrixUpsertInput,
  ShowcaseMatrixValidationError,
} from "../showcase-matrix-handlers.js";

function placementBody(placementSegment: "vh" | "mk", placementType: string) {
  return {
    dealerId: "client-test",
    tradePointId: "tp-1",
    targetKind: "placement",
    targetId: "block-1",
    status: "installed",
    placementType,
    placementSegment,
  };
}

describe("showcase matrix portal_second placement type", () => {
  it("accepts portal_second for mk segment", () => {
    const input = parseShowcaseMatrixUpsertInput(placementBody("mk", "portal_second"));
    expect(input.placementType).toBe("portal_second");
    expect(input.placementSegment).toBe("mk");
  });

  it("rejects portal_second for vh segment", () => {
    expect(() => parseShowcaseMatrixUpsertInput(placementBody("vh", "portal_second"))).toThrow(
      ShowcaseMatrixValidationError,
    );
    expect(() => parseShowcaseMatrixUpsertInput(placementBody("vh", "portal_second"))).toThrow(
      "Тип «2-й план» доступен только для сегмента МК-двери.",
    );
  });
});
