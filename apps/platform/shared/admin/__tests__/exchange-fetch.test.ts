import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyExchangeRootPrefix,
  encodeExchangePathForProxy,
  getBitrixOrdersFtpPath,
  getFtpExchangeBase,
  resolveCatalogFtpPath,
  resolveCatalogFtpSubpath,
  resolveExchangeFtpAbsolutePath,
  resolveExchangeRootPrefix,
} from "../exchange-fetch.js";
import { getDistributionFtpDir } from "../../distribution-export/ftp-uploader.js";

describe("resolveExchangeRootPrefix", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = envBackup;
  });

  it("returns empty string when env unset", () => {
    delete process.env.EXCHANGE_ROOT_PREFIX;
    expect(resolveExchangeRootPrefix()).toBe("");
  });

  it("normalizes leading slash and strips trailing slash", () => {
    process.env.EXCHANGE_ROOT_PREFIX = "full_import (test)/";
    expect(resolveExchangeRootPrefix()).toBe("/full_import (test)");
  });
});

describe("applyExchangeRootPrefix", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = envBackup;
  });

  it("returns subpath unchanged when EXCHANGE_ROOT_PREFIX empty", () => {
    delete process.env.EXCHANGE_ROOT_PREFIX;
    expect(applyExchangeRootPrefix("/import_stores/stores1.xml")).toBe(
      "/import_stores/stores1.xml",
    );
  });

  it("prepends test folder when EXCHANGE_ROOT_PREFIX set", () => {
    process.env.EXCHANGE_ROOT_PREFIX = "/full_import (test)";
    expect(applyExchangeRootPrefix("/import_stores/stores1.xml")).toBe(
      "/full_import (test)/import_stores/stores1.xml",
    );
  });

  it("normalizes leading and trailing slashes on prefix", () => {
    process.env.EXCHANGE_ROOT_PREFIX = "full_import (test)/";
    expect(applyExchangeRootPrefix("/import_users/users1.xml")).toBe(
      "/full_import (test)/import_users/users1.xml",
    );
  });

  it("is idempotent when subpath already includes prefix", () => {
    process.env.EXCHANGE_ROOT_PREFIX = "/full_import (test)";
    const prefixed = "/full_import (test)/import_stores/stores1.xml";
    expect(applyExchangeRootPrefix(prefixed)).toBe(prefixed);
  });

  it("URL-encodes correctly for proxy URL", () => {
    process.env.EXCHANGE_ROOT_PREFIX = "/full_import (test)";
    const path = applyExchangeRootPrefix("/import_stores/stores1.xml");
    const encoded = encodeURIComponent(path);
    expect(encoded).toContain("full_import");
    expect(encoded).toContain("%20");
    expect(encoded).toContain("(test)");
  });

  it("encodeExchangePathForProxy escapes parentheses", () => {
    process.env.EXCHANGE_ROOT_PREFIX = "/full_import (test)";
    const path = applyExchangeRootPrefix("/import_stores/stores1.xml");
    const encoded = encodeExchangePathForProxy(path);
    expect(encoded).toContain("%28");
    expect(encoded).toContain("%29");
  });
});

describe("resolveCatalogFtpSubpath", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = envBackup;
  });

  it("uses /full_import/catalog1.xml in production", () => {
    delete process.env.EXCHANGE_ROOT_PREFIX;
    expect(resolveCatalogFtpSubpath()).toBe("/full_import/catalog1.xml");
  });

  it("uses /catalog1.xml at prefix root in test mode", () => {
    process.env.EXCHANGE_ROOT_PREFIX = "/full_import (test)";
    expect(resolveCatalogFtpSubpath()).toBe("/catalog1.xml");
  });
});

describe("resolveCatalogFtpPath", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.FTP_EXCHANGE_BASE = "/s3/IMG/exchange";
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("builds production catalog path", () => {
    delete process.env.EXCHANGE_ROOT_PREFIX;
    expect(resolveCatalogFtpPath()).toBe("/s3/IMG/exchange/full_import/catalog1.xml");
  });

  it("builds test catalog path without nested full_import", () => {
    process.env.EXCHANGE_ROOT_PREFIX = "/full_import (test)";
    expect(resolveCatalogFtpPath()).toBe("/s3/IMG/exchange/full_import (test)/catalog1.xml");
  });
});

describe("getBitrixOrdersFtpPath", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.FTP_EXCHANGE_BASE = "/s3/IMG/exchange";
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("builds production orders path", () => {
    delete process.env.EXCHANGE_ROOT_PREFIX;
    expect(getBitrixOrdersFtpPath()).toBe("/s3/IMG/exchange/import_orders/orders11.xml");
  });

  it("builds test orders path", () => {
    process.env.EXCHANGE_ROOT_PREFIX = "/full_import (test)";
    expect(getBitrixOrdersFtpPath()).toBe(
      "/s3/IMG/exchange/full_import (test)/import_orders/orders11.xml",
    );
  });
});

describe("getDistributionFtpDir", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.FTP_EXCHANGE_BASE = "/s3/IMG/exchange";
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("builds production from_lk dir", () => {
    delete process.env.EXCHANGE_ROOT_PREFIX;
    expect(getDistributionFtpDir()).toBe("/s3/IMG/exchange/from_lk");
  });

  it("builds test from_lk dir", () => {
    process.env.EXCHANGE_ROOT_PREFIX = "/full_import (test)";
    expect(getDistributionFtpDir()).toBe("/s3/IMG/exchange/full_import (test)/from_lk");
  });
});

describe("resolveExchangeFtpAbsolutePath", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.FTP_EXCHANGE_BASE = "/s3/IMG/exchange";
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("prefixes logical subpath", () => {
    process.env.EXCHANGE_ROOT_PREFIX = "/full_import (test)";
    expect(resolveExchangeFtpAbsolutePath("/import_stores")).toBe(
      "/s3/IMG/exchange/full_import (test)/import_stores",
    );
  });

  it("prefixes absolute path under exchange base", () => {
    process.env.EXCHANGE_ROOT_PREFIX = "/full_import (test)";
    expect(resolveExchangeFtpAbsolutePath("/s3/IMG/exchange/import_stores")).toBe(
      "/s3/IMG/exchange/full_import (test)/import_stores",
    );
  });

  it("leaves production paths unchanged when prefix empty", () => {
    delete process.env.EXCHANGE_ROOT_PREFIX;
    expect(getFtpExchangeBase()).toBe("/s3/IMG/exchange");
    expect(resolveExchangeFtpAbsolutePath("/s3/IMG/exchange/import_stores")).toBe(
      "/s3/IMG/exchange/import_stores",
    );
  });
});
