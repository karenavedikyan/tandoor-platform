import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShowcaseMatrixEntryDto } from "../showcase-matrix-api";
import {
  __clearShowcaseScopeCache,
  fetchShowcaseMatrixScope,
  SCOPE_RESULT_TTL_MS,
} from "../showcase-matrix-api";

function makeEntry(tradePointId: string): ShowcaseMatrixEntryDto {
  return {
    id: `e-${tradePointId}`,
    dealerId: "d1",
    tradePointId,
    targetKind: "model",
    targetId: "m1",
    status: "installed",
    comment: null,
    updatedAt: "2026-06-16T00:00:00.000Z",
    updatedBy: null,
    updatedByName: null,
    placementType: null,
    placementSegment: null,
    placementCapacity: null,
    placementActual: null,
    placementRef: null,
    placementOurModels: [],
    placementCompetitors: [],
  };
}

describe("fetchShowcaseMatrixScope dedup and TTL cache", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __clearShowcaseScopeCache();
    fetchMock = vi.fn(async (_input: RequestInfo, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        tradePointIds: string[];
      };
      const entries = body.tradePointIds.map((id) => makeEntry(id));
      return new Response(JSON.stringify({ success: true, entries }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    __clearShowcaseScopeCache();
  });

  it("deduplicates in-flight parallel calls for the same chunk", async () => {
    const ids = ["tp-a", "tp-b"];
    const [r1, r2] = await Promise.all([
      fetchShowcaseMatrixScope({ tradePointIds: ids, statuses: ["installed"] }),
      fetchShowcaseMatrixScope({ tradePointIds: [...ids].reverse(), statuses: ["installed"] }),
    ]);
    expect(r1).toEqual(r2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns cached result within TTL without network", async () => {
    const ids = ["tp-1"];
    await fetchShowcaseMatrixScope({ tradePointIds: ids, statuses: ["installed"] });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await fetchShowcaseMatrixScope({ tradePointIds: ids, statuses: ["installed"] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetches again after TTL expires", async () => {
    const ids = ["tp-1"];
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1_000);
    await fetchShowcaseMatrixScope({ tradePointIds: ids, statuses: ["installed"] });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000 + SCOPE_RESULT_TTL_MS + 1);
    await fetchShowcaseMatrixScope({ tradePointIds: ids, statuses: ["installed"] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  it("__clearShowcaseScopeCache resets cache and allows new fetch", async () => {
    const ids = ["tp-1"];
    await fetchShowcaseMatrixScope({ tradePointIds: ids, statuses: ["installed"] });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    __clearShowcaseScopeCache();
    await fetchShowcaseMatrixScope({ tradePointIds: ids, statuses: ["installed"] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
