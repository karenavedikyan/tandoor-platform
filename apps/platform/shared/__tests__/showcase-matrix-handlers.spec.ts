import { describe, expect, it } from "vitest";
import { parseShowcaseMatrixUpsertInput } from "../showcase-matrix-handlers.js";

const MODEL_UUID = "413ef265-1234-4abc-8def-0123456789ab";
const PLACEMENT_UUID = "abcdef12-3456-7890-abcd-ef1234567890";

describe("parseShowcaseMatrixUpsertInput 1C UUID validation", () => {
  it("отклоняет upsert entry с не-UUID targetId при targetKind='model'", () => {
    expect(() =>
      parseShowcaseMatrixUpsertInput({
        dealerId: "d1",
        tradePointId: "tp1",
        targetKind: "model",
        targetId: "tc-vh-era-grafit",
        status: "installed",
      }),
    ).toThrow(/не связана с товаром 1С/);
  });

  it("принимает upsert entry с UUID targetId при targetKind='model'", () => {
    const result = parseShowcaseMatrixUpsertInput({
      dealerId: "d1",
      tradePointId: "tp1",
      targetKind: "model",
      targetId: MODEL_UUID,
      status: "not_relevant",
    });
    expect(result.targetId).toBe(MODEL_UUID);
  });

  it("пропускает targetKind='placement' с любым UUID (client-side)", () => {
    const result = parseShowcaseMatrixUpsertInput({
      dealerId: "d1",
      tradePointId: "tp1",
      targetKind: "placement",
      targetId: PLACEMENT_UUID,
      status: "installed",
      placementType: "portal",
      placementSegment: "vh",
      placementCapacity: 10,
      placementActual: 5,
    });
    expect(result.targetKind).toBe("placement");
    expect(result.targetId).toBe(PLACEMENT_UUID);
  });

  it("отклоняет placement_our_models с не-UUID modelId", () => {
    expect(() =>
      parseShowcaseMatrixUpsertInput({
        dealerId: "d1",
        tradePointId: "tp1",
        targetKind: "placement",
        targetId: PLACEMENT_UUID,
        status: "installed",
        placementType: "portal",
        placementSegment: "vh",
        placementCapacity: 10,
        placementActual: 5,
        placementOurModels: [{ modelId: "tc-vh-era", count: 1 }],
      }),
    ).toThrow(/не связана с товаром 1С/);
  });
});
