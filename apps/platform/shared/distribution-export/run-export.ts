import type { PoolLike } from "../../server/db/neon-client.js";
import { buildDistributionExport } from "./builder.js";
import { uploadDistributionToFtp } from "./ftp-uploader.js";

export type DistributionExportRunResult = {
  storeCount: number;
  unmatchedDealers: string[];
  latestPath: string;
  snapshotPath: string;
  sizeBytes: number;
  removedSnapshots: number;
  elapsedMs: number;
};

export async function runDistributionExport(pool: PoolLike): Promise<DistributionExportRunResult> {
  const started = Date.now();
  const now = new Date();
  const data = await buildDistributionExport(pool, now);
  const upload = await uploadDistributionToFtp(data, now);
  const elapsedMs = Date.now() - started;

  console.log(
    `[distribution-export] stores=${data.stores.length} unmatched=${data.unmatched_dealers.length} ` +
      `size=${upload.sizeBytes} elapsed=${elapsedMs}ms latest=${upload.latestPath}`,
  );

  return {
    storeCount: data.stores.length,
    unmatchedDealers: data.unmatched_dealers,
    latestPath: upload.latestPath,
    snapshotPath: upload.snapshotPath,
    sizeBytes: upload.sizeBytes,
    removedSnapshots: upload.removedSnapshots,
    elapsedMs,
  };
}
