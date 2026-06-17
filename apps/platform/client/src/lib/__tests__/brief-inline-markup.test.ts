import { describe, expect, it } from "vitest";
import { wrapBriefTextSelection } from "../../components/marketing-brief/marketing-brief-blocks-published.js";

describe("brief inline markup", () => {
  it("wraps selection in bold markers", () => {
    const next = wrapBriefTextSelection("hello world", 6, 11, "bold");
    expect(next).toBe("hello **world**");
  });

  it("wraps selection in italic markers", () => {
    const next = wrapBriefTextSelection("abc", 0, 3, "italic");
    expect(next).toBe("*abc*");
  });

  it("wraps selection in link markdown", () => {
    const next = wrapBriefTextSelection("клик", 0, 4, "link", "https://example.com");
    expect(next).toBe("[клик](https://example.com)");
  });

  it("uses placeholder when selection is empty", () => {
    const next = wrapBriefTextSelection("prefix", 6, 6, "bold");
    expect(next).toBe("prefix**текст**");
  });
});
