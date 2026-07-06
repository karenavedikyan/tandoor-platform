import { describe, expect, it } from "vitest";
import {
  parseShowcaseMatrixUpsertInput,
  ShowcaseMatrixValidationError,
} from "../showcase-matrix-handlers.js";

const MODEL_ENTRY_UUID = "413ef265-1234-4abc-8def-0123456789ab";

function modelBody(overrides: Record<string, unknown> = {}) {
  return {
    dealerId: "client-test",
    tradePointId: "tp-1",
    targetKind: "model",
    targetId: MODEL_ENTRY_UUID,
    status: "installed",
    ...overrides,
  };
}

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

describe("showcase matrix model placement type", () => {
  it("requires placementType and placementSegment for installed model", () => {
    expect(() => parseShowcaseMatrixUpsertInput(modelBody())).toThrow(ShowcaseMatrixValidationError);
    expect(() => parseShowcaseMatrixUpsertInput(modelBody())).toThrow(
      "Для установленной модели обязателен тип крепления (placementType) и сегмент (placementSegment).",
    );
  });

  it("preserves valid placement fields for installed model", () => {
    const input = parseShowcaseMatrixUpsertInput(
      modelBody({ placementType: "portal", placementSegment: "vh" }),
    );
    expect(input.placementType).toBe("portal");
    expect(input.placementSegment).toBe("vh");
    expect(input.placementCapacity).toBeNull();
    expect(input.placementActual).toBeNull();
    expect(input.placementOurModels).toEqual([]);
    expect(input.placementCompetitors).toEqual([]);
    expect(input.placementLegacyOurs).toBeNull();
  });

  it("accepts portal_second for mk installed model", () => {
    const input = parseShowcaseMatrixUpsertInput(
      modelBody({ placementType: "portal_second", placementSegment: "mk" }),
    );
    expect(input.placementType).toBe("portal_second");
    expect(input.placementSegment).toBe("mk");
  });

  it("rejects branded_stand for vh installed model", () => {
    expect(() =>
      parseShowcaseMatrixUpsertInput(
        modelBody({ placementType: "branded_stand", placementSegment: "vh" }),
      ),
    ).toThrow(ShowcaseMatrixValidationError);
    expect(() =>
      parseShowcaseMatrixUpsertInput(
        modelBody({ placementType: "branded_stand", placementSegment: "vh" }),
      ),
    ).toThrow("Для сегментов vh и mk допустимы только типы portal, cube, book, hoof, unmounted.");
  });

  it("clears placement fields for non-installed model", () => {
    const input = parseShowcaseMatrixUpsertInput(
      modelBody({
        status: "not_relevant",
        placementType: "portal",
        placementSegment: "vh",
      }),
    );
    expect(input.placementType).toBeNull();
    expect(input.placementSegment).toBeNull();
  });

  it("does not change placement block normalization", () => {
    const input = parseShowcaseMatrixUpsertInput(placementBody("mk", "portal_second"));
    expect(input.placementType).toBe("portal_second");
    expect(input.placementSegment).toBe("mk");
    expect(input.status).toBe("installed");
  });
});
