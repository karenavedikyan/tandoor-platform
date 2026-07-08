import type { DistributionExportDto } from "./builder.js";

export const DISTRIBUTION_FTP_DIR = "/s3/IMG/exchange/from_lk";
export const DISTRIBUTION_LATEST_FILENAME = "distribution_latest.json";
export const DISTRIBUTION_SNAPSHOT_PREFIX = "distribution_";
const SNAPSHOT_RETENTION_DAYS = 30;

export function distributionSnapshotFilename(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const h = String(now.getUTCHours()).padStart(2, "0");
  return `distribution_${y}-${m}-${d}_${h}.json`;
}

type ProxyConfig = {
  baseUrl: string;
  token: string;
};

function resolveProxyConfig(): ProxyConfig {
  const baseUrl = process.env.EXCHANGE_PROXY_URL?.trim() || "";
  const token =
    process.env.EXCHANGE_PROXY_TOKEN?.trim() ||
    process.env.SYNC_RUNNER_TOKEN?.trim() ||
    "";
  if (!baseUrl) throw new Error("EXCHANGE_PROXY_URL is not configured.");
  if (!token) throw new Error("EXCHANGE_PROXY_TOKEN / SYNC_RUNNER_TOKEN is not configured.");
  return { baseUrl: baseUrl.replace(/\/$/, ""), token };
}

async function proxyUpload(
  cfg: ProxyConfig,
  path: string,
  contentBase64: string,
  options: { purgeSnapshotsOlderThanMs?: number; snapshotPrefix?: string } = {},
): Promise<{ removedSnapshots: number }> {
  const res = await fetch(`${cfg.baseUrl}/exchange/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.token}`,
    },
    body: JSON.stringify({
      path,
      contentBase64,
      purgeSnapshotsOlderThanMs: options.purgeSnapshotsOlderThanMs,
      snapshotPrefix: options.snapshotPrefix,
    }),
  });
  const text = await res.text();
  let parsed: { ok?: boolean; code?: string; message?: string; removedSnapshots?: number } | null = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* ignore */
  }
  if (!res.ok || !parsed?.ok) {
    throw new Error(
      `Proxy upload failed (${res.status}): ${parsed?.code ?? "?"} ${parsed?.message ?? text.slice(0, 200)}`,
    );
  }
  return { removedSnapshots: Number(parsed.removedSnapshots ?? 0) };
}

export async function uploadDistributionToFtp(
  data: DistributionExportDto,
  now: Date = new Date(),
): Promise<{
  latestPath: string;
  snapshotPath: string;
  sizeBytes: number;
  removedSnapshots: number;
}> {
  const cfg = resolveProxyConfig();
  const json = `${JSON.stringify(data, null, 2)}\n`;
  const sizeBytes = Buffer.byteLength(json, "utf8");
  const contentBase64 = Buffer.from(json, "utf8").toString("base64");

  const snapshotName = distributionSnapshotFilename(now);
  const latestPath = `${DISTRIBUTION_FTP_DIR}/${DISTRIBUTION_LATEST_FILENAME}`;
  const snapshotPath = `${DISTRIBUTION_FTP_DIR}/${snapshotName}`;

  await proxyUpload(cfg, latestPath, contentBase64);
  const snap = await proxyUpload(cfg, snapshotPath, contentBase64, {
    purgeSnapshotsOlderThanMs: SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    snapshotPrefix: DISTRIBUTION_SNAPSHOT_PREFIX,
  });

  return {
    latestPath,
    snapshotPath,
    sizeBytes,
    removedSnapshots: snap.removedSnapshots,
  };
}
