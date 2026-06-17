import { describe, it, expect } from "vitest";
import { externalKeyToReleaseCode, externalKeysToReleaseCodes } from "../dealer-base-source.js";

describe("392e: externalKey ↔ releaseCode", () => {
  it("отрезает префикс client-", () => {
    expect(externalKeyToReleaseCode("client-ma-ma085093")).toBe("ma-ma085093");
    expect(externalKeyToReleaseCode("client-000000156")).toBe("000000156");
  });
  it("возвращает строку как есть если префикса нет", () => {
    expect(externalKeyToReleaseCode("MA-MA085093")).toBe("MA-MA085093");
    expect(externalKeyToReleaseCode("")).toBe("");
  });
  it("батч-преобразование", () => {
    const out = externalKeysToReleaseCodes(["client-a", "client-b", "raw-c"]);
    expect(out).toEqual(["a", "b", "raw-c"]);
  });
});
