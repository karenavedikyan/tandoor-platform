import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __clearShowcaseScopeCache,
  fetchShowcaseMatrixScope,
  SCOPE_FETCH_TIMEOUT_MS,
} from "../showcase-matrix-api";

describe("fetchShowcaseMatrixScopeChunk timeout", () => {
  beforeEach(() => {
    __clearShowcaseScopeCache();
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        });
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    __clearShowcaseScopeCache();
  });

  it("returns null after abort timeout instead of hanging", async () => {
    const promise = fetchShowcaseMatrixScope({ tradePointIds: ["tp-hang"], statuses: ["installed"] });
    await vi.advanceTimersByTimeAsync(SCOPE_FETCH_TIMEOUT_MS);
    await expect(promise).resolves.toBeNull();
  });

  it("clears in-flight entry after timeout so a later call can retry", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const promise = fetchShowcaseMatrixScope({ tradePointIds: ["tp-retry"], statuses: ["installed"] });
    await vi.advanceTimersByTimeAsync(SCOPE_FETCH_TIMEOUT_MS);
    await expect(promise).resolves.toBeNull();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, entries: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const retryPromise = fetchShowcaseMatrixScope({ tradePointIds: ["tp-retry"], statuses: ["installed"] });
    await expect(retryPromise).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
