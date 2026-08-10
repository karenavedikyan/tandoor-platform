import { describe, expect, it } from "vitest";
import { validateDistributionUploadPath } from "../sync-1c-runner.mjs";

describe("validateDistributionUploadPath", () => {
  it("accepts production from_lk path", () => {
    expect(validateDistributionUploadPath("/s3/IMG/exchange/from_lk/distribution_latest.json")).toBe(
      "/s3/IMG/exchange/from_lk/distribution_latest.json",
    );
  });

  it("accepts test prefix with spaces and parentheses", () => {
    expect(
      validateDistributionUploadPath(
        "/s3/IMG/exchange/full_import (test)/from_lk/distribution_latest.json",
      ),
    ).toBe("/s3/IMG/exchange/full_import (test)/from_lk/distribution_latest.json");
  });

  it("accepts snapshot filename with date parts", () => {
    expect(
      validateDistributionUploadPath(
        "/s3/IMG/exchange/full_import (test)/from_lk/distribution_2026-08-10_15.json",
      ),
    ).toBe("/s3/IMG/exchange/full_import (test)/from_lk/distribution_2026-08-10_15.json");
  });

  it("rejects path traversal", () => {
    expect(validateDistributionUploadPath("/s3/IMG/exchange/../etc/passwd")).toBeNull();
  });

  it("rejects paths outside exchange/from_lk layout", () => {
    expect(validateDistributionUploadPath("/other/path/from_lk/file.json")).toBeNull();
  });

  it("rejects spaces in filename", () => {
    expect(
      validateDistributionUploadPath("/s3/IMG/exchange/from_lk/file with space.json"),
    ).toBeNull();
  });

  it("rejects backslashes", () => {
    expect(validateDistributionUploadPath("/s3/IMG/exchange\\from_lk\\file.json")).toBeNull();
  });
});
