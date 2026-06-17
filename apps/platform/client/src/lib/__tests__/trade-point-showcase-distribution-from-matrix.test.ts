import { beforeEach, describe, expect, it } from "vitest";
import {
  loadCachedMatrix,
  SHOWCASE_MATRIX_STORE_CACHE_KEY,
} from "../showcase-matrix-store.js";
import {
  upsertShowcaseMatrixModelState,
  SHOWCASE_MATRIX_STORAGE_KEY,
} from "../trade-point-showcase-matrix-storage.js";
import { buildSegmentDetail } from "../trade-point-showcase-segment-models.js";
import { SHOWCASE_MATRIX_MODEL_DEFINITIONS } from "../trade-point-showcase-matrix-models.js";

const DEALER = "client-test-353";
const TP = `${DEALER}-default`;
const ACTOR = "user-test-353";
const ACTOR_NAME = "Тест Тестов";

function entrance() {
  return SHOWCASE_MATRIX_MODEL_DEFINITIONS.find((m) => m.type === "entrance")!;
}

function interior() {
  return SHOWCASE_MATRIX_MODEL_DEFINITIONS.find((m) => m.type === "interior")!;
}

beforeEach(() => {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.removeItem(SHOWCASE_MATRIX_STORAGE_KEY);
    window.localStorage.removeItem(SHOWCASE_MATRIX_STORE_CACHE_KEY);
  }
});

describe("Промт 353: дистрибуция из матрицы", () => {
  it("upsertShowcaseMatrixModelState зеркалит installed в cache-v1", () => {
    const m = entrance();
    upsertShowcaseMatrixModelState({
      dealerId: DEALER,
      tradePointId: TP,
      model: m,
      status: "installed",
      comment: "",
      actorUserId: ACTOR,
      actorName: ACTOR_NAME,
    });
    const cached = loadCachedMatrix(TP);
    const mirrored = cached.find((e) => e.targetKind === "model" && e.targetId === m.id);
    expect(mirrored).toBeTruthy();
    expect(mirrored?.status).toBe("installed");
    expect(mirrored?.placementSegment).toBe("vh");
  });

  it("buildSegmentDetail видит installed модели даже когда блоки пусты", () => {
    const m = interior();
    upsertShowcaseMatrixModelState({
      dealerId: DEALER,
      tradePointId: TP,
      model: m,
      status: "installed",
      comment: "",
      actorUserId: ACTOR,
      actorName: ACTOR_NAME,
    });
    const entries = loadCachedMatrix(TP);
    const mk = buildSegmentDetail(entries, "mk");
    expect(mk.source).toBe("models");
    expect(mk.totalOurs).toBe(1);
    expect(mk.ourModels.length).toBe(1);
    expect(mk.ourModels[0]?.modelId).toBe(m.id);
  });

  it("buildSegmentDetail объединяет installed модели с placement-блоками", () => {
    const m = interior();
    upsertShowcaseMatrixModelState({
      dealerId: DEALER,
      tradePointId: TP,
      model: m,
      status: "installed",
      comment: "",
      actorUserId: ACTOR,
      actorName: ACTOR_NAME,
    });
    const m2 = SHOWCASE_MATRIX_MODEL_DEFINITIONS.filter(
      (d) => d.type === "interior" && d.id !== m.id,
    )[0]!;
    upsertShowcaseMatrixModelState({
      dealerId: DEALER,
      tradePointId: TP,
      model: m2,
      status: "installed",
      comment: "",
      actorUserId: ACTOR,
      actorName: ACTOR_NAME,
    });
    const entries = loadCachedMatrix(TP);
    const mk = buildSegmentDetail(entries, "mk");
    expect(mk.totalOurs).toBeGreaterThanOrEqual(2);
    expect(mk.ourModels.length).toBeGreaterThanOrEqual(2);
  });

  it("статусы postponed и not_relevant не идут в installed", () => {
    const m = entrance();
    upsertShowcaseMatrixModelState({
      dealerId: DEALER,
      tradePointId: TP,
      model: m,
      status: "postponed",
      comment: "",
      actorUserId: ACTOR,
      actorName: ACTOR_NAME,
    });
    const entries = loadCachedMatrix(TP);
    const vh = buildSegmentDetail(entries, "vh");
    expect(vh.totalOurs).toBe(0);
  });

  it("смена статуса installed -> need_install убирает модель из installed", () => {
    const m = entrance();
    upsertShowcaseMatrixModelState({
      dealerId: DEALER,
      tradePointId: TP,
      model: m,
      status: "installed",
      comment: "",
      actorUserId: ACTOR,
      actorName: ACTOR_NAME,
    });
    let entries = loadCachedMatrix(TP);
    let vh = buildSegmentDetail(entries, "vh");
    expect(vh.totalOurs).toBe(1);

    upsertShowcaseMatrixModelState({
      dealerId: DEALER,
      tradePointId: TP,
      model: m,
      status: "need_install",
      comment: "",
      actorUserId: ACTOR,
      actorName: ACTOR_NAME,
    });
    entries = loadCachedMatrix(TP);
    vh = buildSegmentDetail(entries, "vh");
    expect(vh.totalOurs).toBe(0);
  });
});
