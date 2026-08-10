import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FileType } from "basic-ftp";

const mockAccess = vi.fn();
const mockList = vi.fn();
const mockSize = vi.fn();
const mockDownloadTo = vi.fn();
const mockClose = vi.fn();

vi.mock("basic-ftp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("basic-ftp")>();
  class MockClient {
    ftp = { verbose: false };
    access = mockAccess;
    list = mockList;
    size = mockSize;
    downloadTo = mockDownloadTo;
    close = mockClose;
  }
  return { ...actual, Client: MockClient };
});

const {
  normalizeExchangePath,
  normalizeExchangeListPath,
  buildExchangeListHtml,
  exchangeListFromFtp,
  exchangePeekFromFtp,
  remoteExchangeListPath,
  remoteExchangePeekPath,
} = await import("../yandex-vm/sync-1c-runner.mjs");

describe("normalizeExchangePath", () => {
  it("rejects path without leading slash", () => {
    expect(normalizeExchangePath("stores")).toBeNull();
  });

  it("rejects path traversal", () => {
    expect(normalizeExchangePath("/../etc")).toBeNull();
  });

  it("accepts valid file path", () => {
    expect(normalizeExchangePath("/stores/stores1.xml")).toBe("/stores/stores1.xml");
  });
});

describe("normalizeExchangeListPath", () => {
  it("appends trailing slash for directory paths from API", () => {
    expect(normalizeExchangeListPath("/import_stores")).toBe("/import_stores/");
  });

  it("keeps root slash", () => {
    expect(normalizeExchangeListPath("/")).toBe("/");
  });
});

describe("buildExchangeListHtml", () => {
  it("renders IIS-style listing with dir and file rows", () => {
    const modifiedAt = new Date("2026-07-07T18:42:00Z");
    const html = buildExchangeListHtml("/", [
      { name: "stores", type: FileType.Directory, size: 0, modifiedAt, rawModifiedAt: "", permissions: {}, hardLinks: 0, user: "", group: "", uniqueID: "" },
      { name: "stores1.xml", type: FileType.File, size: 1898, modifiedAt, rawModifiedAt: "", permissions: {}, hardLinks: 0, user: "", group: "", uniqueID: "" },
    ]);

    expect(html).toContain("&lt;dir&gt; <A HREF=\"/images/IMG/exchange/stores/\">stores</A>");
    expect(html).toContain("1898 <A HREF=\"/images/IMG/exchange/stores1.xml\">stores1.xml</A>");
    expect(html).toContain("18:42");
  });
});

describe("remote paths", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...envBackup,
      FTP_EXCHANGE_BASE: "/s3/IMG/exchange",
    };
    delete process.env.EXCHANGE_ROOT_PREFIX;
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("maps list path to FTP base", () => {
    expect(remoteExchangeListPath("/")).toBe("/s3/IMG/exchange/");
    expect(remoteExchangeListPath("/import_stores/")).toBe("/s3/IMG/exchange/import_stores/");
  });

  it("maps peek path to FTP file", () => {
    expect(remoteExchangePeekPath("/import_stores/stores1.xml")).toBe(
      "/s3/IMG/exchange/import_stores/stores1.xml",
    );
  });

  it("applies EXCHANGE_ROOT_PREFIX for test folder", () => {
    process.env.EXCHANGE_ROOT_PREFIX = "/full_import (test)";
    expect(remoteExchangeListPath("/import_stores/")).toBe(
      "/s3/IMG/exchange/full_import (test)/import_stores/",
    );
    expect(remoteExchangePeekPath("/import_stores/stores1.xml")).toBe(
      "/s3/IMG/exchange/full_import (test)/import_stores/stores1.xml",
    );
  });
});

describe("exchangeListFromFtp", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...envBackup,
      FTP_USER: "user",
      FTP_PASSWORD: "pass",
      FTP_EXCHANGE_BASE: "/s3/IMG/exchange",
    };
    mockAccess.mockResolvedValue(undefined);
    mockList.mockResolvedValue([
      {
        name: "stores",
        type: FileType.Directory,
        size: 0,
        modifiedAt: new Date("2026-07-07T10:00:00Z"),
        rawModifiedAt: "",
        permissions: {},
        hardLinks: 0,
        user: "",
        group: "",
        uniqueID: "",
      },
    ]);
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("lists directory via FTP and returns HTML", async () => {
    const html = await exchangeListFromFtp("/");
    expect(mockAccess).toHaveBeenCalled();
    expect(mockList).toHaveBeenCalledWith("/s3/IMG/exchange/");
    expect(html).toContain("stores");
    expect(html).toContain("&lt;dir&gt;");
  });

  it("throws when FTP credentials missing", async () => {
    delete process.env.FTP_USER;
    await expect(exchangeListFromFtp("/")).rejects.toThrow(/FTP_USER/);
  });
});

describe("exchangePeekFromFtp", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...envBackup,
      FTP_USER: "user",
      FTP_PASSWORD: "pass",
      FTP_EXCHANGE_BASE: "/s3/IMG/exchange",
    };
    mockAccess.mockResolvedValue(undefined);
    mockSize.mockResolvedValue(1000);
    mockDownloadTo.mockImplementation(async (writable, _remote, _startAt) => {
      const payload = Buffer.alloc(1000, "x");
      writable.write(payload);
      writable.end();
    });
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it("returns only requested bytes", async () => {
    const { buf, totalSize } = await exchangePeekFromFtp("/stores/stores1.xml", 500);
    expect(totalSize).toBe(1000);
    expect(buf.length).toBe(500);
    expect(mockDownloadTo).toHaveBeenCalled();
  });

  it("maps FTP 550 to NOT_FOUND", async () => {
    const err = new Error("550 File unavailable");
    Object.assign(err, { code: 550 });
    mockSize.mockRejectedValue(err);
    await expect(exchangePeekFromFtp("/missing.xml", 500)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("exchange list bad path via normalize", () => {
  it("rejects bare relative path", () => {
    expect(normalizeExchangeListPath("import_stores")).toBeNull();
  });

  it("rejects path with backslashes", () => {
    expect(normalizeExchangeListPath("/foo\\bar/")).toBeNull();
  });
});
