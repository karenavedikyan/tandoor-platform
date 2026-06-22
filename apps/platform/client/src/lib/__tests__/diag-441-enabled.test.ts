/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isDiag441Enabled } from "@/lib/diag-441-enabled";

describe("isDiag441Enabled", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("returns false when diag is absent", () => {
    window.location.hash = "#/distribution?view=analytics";
    expect(isDiag441Enabled()).toBe(false);
  });

  it("returns true when diag=1 is in hash and sticks in sessionStorage", () => {
    window.location.hash = "#/distribution?view=analytics&diag=1";
    expect(isDiag441Enabled()).toBe(true);
    window.location.hash = "#/distribution?view=analytics&tab=trade-points&f=abc";
    expect(isDiag441Enabled()).toBe(true);
  });

  it("stays enabled from sessionStorage after diag removed from URL", () => {
    window.sessionStorage.setItem("diag441", "1");
    window.location.hash = "#/distribution?view=analytics";
    expect(isDiag441Enabled()).toBe(true);
  });
});
