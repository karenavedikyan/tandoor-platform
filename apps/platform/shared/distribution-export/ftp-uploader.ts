import { Readable } from "node:stream";
import * as ftp from "basic-ftp";
import type { DistributionExportDto } from "./builder.js";

export const DISTRIBUTION_FTP_DIR = "/s3/IMG/exchange/from_lk";
export const DISTRIBUTION_LATEST_FILENAME = "distribution_latest.json";

const SNAPSHOT_RE = /^distribution_(\d{4})-(\d{2})-(\d{2})_(\d{2})\.json$/;
const SNAPSHOT_RETENTION_DAYS = 30;

export type DistributionFtpConfig = {
  host: string;
  user: string;
  password: string;
  secure: boolean;
};

export function resolveDistributionFtpConfig(): DistributionFtpConfig {
  const host =
    process.env.BITRIX_ORDERS_FTP_HOST?.trim() ||
    process.env.FTP_HOST?.trim() ||
    "gw.toopatch.ru";
  const user =
    process.env.TANDOOR_DISTRIBUTION_FTP_USER?.trim() ||
    process.env.BITRIX_ORDERS_FTP_USER?.trim() ||
    process.env.FTP_USER?.trim() ||
    "";
  const password =
    process.env.TANDOOR_DISTRIBUTION_FTP_PASSWORD?.trim() ||
    process.env.BITRIX_ORDERS_FTP_PASSWORD?.trim() ||
    process.env.FTP_PASSWORD?.trim() ||
    "";
  if (!user || !password) {
    throw new Error("FTP credentials are not configured (FTP_USER / FTP_PASSWORD).");
  }
  return {
    host,
    user,
    password,
    secure: process.env.FTP_SECURE === "1",
  };
}

export function distributionSnapshotFilename(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const h = String(now.getUTCHours()).padStart(2, "0");
  return `distribution_${y}-${m}-${d}_${h}.json`;
}

function snapshotDateFromName(name: string): Date | null {
  const m = SNAPSHOT_RE.exec(name);
  if (!m) return null;
  const [, y, mo, d, h] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), 0, 0, 0));
}

async function purgeOldSnapshots(client: ftp.Client, now: Date): Promise<number> {
  const cutoff = now.getTime() - SNAPSHOT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  const list = await client.list(DISTRIBUTION_FTP_DIR);
  for (const item of list) {
    if (item.type !== ftp.FileType.File) continue;
    const snapAt = snapshotDateFromName(item.name);
    if (!snapAt || snapAt.getTime() >= cutoff) continue;
    await client.remove(`${DISTRIBUTION_FTP_DIR}/${item.name}`);
    removed += 1;
  }
  return removed;
}

export async function uploadDistributionToFtp(
  data: DistributionExportDto,
  now: Date = new Date(),
): Promise<{ latestPath: string; snapshotPath: string; sizeBytes: number; removedSnapshots: number }> {
  const cfg = resolveDistributionFtpConfig();
  const json = `${JSON.stringify(data, null, 2)}\n`;
  const sizeBytes = Buffer.byteLength(json, "utf8");
  const snapshotName = distributionSnapshotFilename(now);
  const latestPath = `${DISTRIBUTION_FTP_DIR}/${DISTRIBUTION_LATEST_FILENAME}`;
  const snapshotPath = `${DISTRIBUTION_FTP_DIR}/${snapshotName}`;

  const client = new ftp.Client(60_000);
  try {
    await client.access({
      host: cfg.host,
      user: cfg.user,
      password: cfg.password,
      secure: cfg.secure,
    });
    await client.ensureDir(DISTRIBUTION_FTP_DIR);
    const body = Readable.from([json]);
    await client.uploadFrom(body, latestPath);
    const bodySnapshot = Readable.from([json]);
    await client.uploadFrom(bodySnapshot, snapshotPath);
    const removedSnapshots = await purgeOldSnapshots(client, now);
    return { latestPath, snapshotPath, sizeBytes, removedSnapshots };
  } finally {
    client.close();
  }
}
