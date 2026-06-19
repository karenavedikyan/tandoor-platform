/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { startBuildVersionPoll, stopBuildVersionPollForTests } from "../build-version-poll";

const META_COMMIT_NAME = "tandoor-build-commit";

function setMeta(commit: string | null) {
  let el = document.querySelector(`meta[name="${META_COMMIT_NAME}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", META_COMMIT_NAME);
    document.head.appendChild(el);
  }
  if (commit === null) el.remove();
  else el.setAttribute("content", commit);
}

describe("build-version-poll", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopBuildVersionPollForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    stopBuildVersionPollForTests();
    setMeta(null);
    vi.restoreAllMocks();
  });

  it("при совпадении commit reload не вызывается", async () => {
    setMeta("aaa111");
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ success: true, commit: "aaa111" }), { status: 200 }),
      ),
    );
    startBuildVersionPoll();
    await vi.advanceTimersByTimeAsync(40 * 1000);
    expect(reload).not.toHaveBeenCalled();
  });

  it("при расхождении commit reload вызывается через задержку", async () => {
    setMeta("aaa111");
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ success: true, commit: "bbb222" }), { status: 200 }),
      ),
    );
    startBuildVersionPoll();
    await vi.advanceTimersByTimeAsync(40 * 1000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("при meta=dev опрос не делается", async () => {
    setMeta("dev");
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    startBuildVersionPoll();
    await vi.advanceTimersByTimeAsync(40 * 1000);
    expect(reload).not.toHaveBeenCalled();
    // fetch не должен быть вызван, потому что мы рано выходим в checkOnce
    expect(f).not.toHaveBeenCalled();
  });
});
