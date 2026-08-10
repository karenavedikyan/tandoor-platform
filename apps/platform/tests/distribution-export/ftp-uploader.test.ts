import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDistributionFtpDir,
  DISTRIBUTION_LATEST_FILENAME,
  uploadDistributionToFtp,
} from "../../shared/distribution-export/ftp-uploader.js";
import type { DistributionExportDto } from "../../shared/distribution-export/builder.js";

const sampleData: DistributionExportDto = {
  generated_at: "2026-07-08T15:00:00.000Z",
  source: "lk.tandoor.ru",
  version: 2,
  level: 2,
  stores: [],
  unmatched_dealers: [],
};

describe("uploadDistributionToFtp", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    process.env.EXCHANGE_PROXY_URL = "https://proxy.example";
    process.env.EXCHANGE_PROXY_TOKEN = "test-token";
    delete process.env.EXCHANGE_ROOT_PREFIX;
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ ok: true, removedSnapshots: 2 }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.EXCHANGE_PROXY_URL;
    delete process.env.EXCHANGE_PROXY_TOKEN;
    fetchMock.mockReset();
  });

  it("uploads latest and snapshot via proxy", async () => {
    const now = new Date("2026-07-08T15:00:00.000Z");
    const result = await uploadDistributionToFtp(sampleData, now);

    expect(result.latestPath).toBe(`${getDistributionFtpDir()}/${DISTRIBUTION_LATEST_FILENAME}`);
    expect(result.snapshotPath).toBe(`${getDistributionFtpDir()}/distribution_2026-07-08_15.json`);
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.removedSnapshots).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [latestUrl, latestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(latestUrl).toBe("https://proxy.example/exchange/upload");
    expect(latestInit.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    });
    const latestBody = JSON.parse(String(latestInit.body));
    expect(latestBody.path).toBe(result.latestPath);
    expect(latestBody.contentBase64).toBeTruthy();
    expect(latestBody.purgeSnapshotsOlderThanMs).toBeUndefined();

    const [, snapshotInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const snapshotBody = JSON.parse(String(snapshotInit.body));
    expect(snapshotBody.path).toBe(result.snapshotPath);
    expect(snapshotBody.purgeSnapshotsOlderThanMs).toBe(30 * 24 * 60 * 60 * 1000);
    expect(snapshotBody.snapshotPrefix).toBe("distribution_");
  });

  it("throws when proxy URL is missing", async () => {
    delete process.env.EXCHANGE_PROXY_URL;
    await expect(uploadDistributionToFtp(sampleData)).rejects.toThrow("EXCHANGE_PROXY_URL is not configured.");
  });
});
