import { describe, expect, it } from "vitest";
import { mergeBlocksFromServer } from "../brief-blocks-editor-state";
import type { MarketingBriefBlockRow } from "../marketing-briefs-api.js";

function textBlock(id: string, body: string, order = 0): MarketingBriefBlockRow {
  return {
    id,
    brief_id: "brief-1",
    type: "text",
    order_index: order,
    payload: { heading: "", body },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("mergeBlocksFromServer", () => {
  it("keeps local payload for dirty blocks when server refetches stale snapshot", () => {
    const local = [textBlock("b1", "hello")];
    const server = [textBlock("b1", "hel")];
    const dirty = new Set(["b1"]);

    const merged = mergeBlocksFromServer(server, local, dirty);

    expect(merged[0]?.payload).toEqual({ heading: "", body: "hello" });
  });

  it("uses server version for clean blocks", () => {
    const local = [textBlock("b1", "local")];
    const server = [textBlock("b1", "server")];
    const merged = mergeBlocksFromServer(server, local, new Set());

    expect(merged[0]?.payload).toEqual({ heading: "", body: "server" });
  });

  it("simulates fast typing: five keystrokes survive first PATCH response", () => {
    let local = [textBlock("b1", "")];
    const dirty = new Set<string>();

    const keystrokes = ["a", "ab", "abc", "abcd", "abcde"];
    for (const body of keystrokes) {
      dirty.add("b1");
      local = local.map((b) =>
        b.id === "b1" ? { ...b, payload: { ...b.payload, body } } : b,
      );
    }

    const serverAfterFirstPatch = [textBlock("b1", "a")];
    const afterRefetch = mergeBlocksFromServer(serverAfterFirstPatch, local, dirty);

    expect((afterRefetch[0]?.payload as { body: string }).body).toBe("abcde");
  });
});
