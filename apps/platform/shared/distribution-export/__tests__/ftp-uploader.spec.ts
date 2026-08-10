import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDistributionFtpDir } from "../ftp-uploader.js";

describe("getDistributionFtpDir", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.FTP_EXCHANGE_BASE = "/s3/IMG/exchange";
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("returns /s3/IMG/exchange/from_lk when EXCHANGE_ROOT_PREFIX is unset", () => {
    delete process.env.EXCHANGE_ROOT_PREFIX;
    expect(getDistributionFtpDir()).toBe("/s3/IMG/exchange/from_lk");
  });

  it("returns test folder path when EXCHANGE_ROOT_PREFIX is set", () => {
    process.env.EXCHANGE_ROOT_PREFIX = "/full_import (test)";
    expect(getDistributionFtpDir()).toBe("/s3/IMG/exchange/full_import (test)/from_lk");
  });

  it("normalizes leading and trailing slashes in prefix", () => {
    process.env.EXCHANGE_ROOT_PREFIX = "full_import (test)/";
    expect(getDistributionFtpDir()).toBe("/s3/IMG/exchange/full_import (test)/from_lk");
  });
});
