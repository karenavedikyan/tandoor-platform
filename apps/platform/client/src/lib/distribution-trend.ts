/**
 * Тренд дистрибуции по событиям showcase_matrix_events (чистые функции).
 */

import type { ShowcaseMatrixEventDto } from "@/lib/showcase-matrix-api";

export type TrendBucket = "day" | "week";

export type DistributionTrendPoint = {
  bucketIso: string;
  bucketLabel: string;
  installEvents: number;
  changeEvents: number;
  cumulativeInstalled: number;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDayLabel(bucketIso: string): string {
  const [y, m, d] = bucketIso.split("-");
  if (!y || !m || !d) return bucketIso;
  return `${d}.${m}`;
}

function formatWeekLabel(bucketIso: string): string {
  return `нед. ${formatDayLabel(bucketIso)}`;
}

function parseIsoMs(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** Начало UTC-дня для ISO timestamp. */
export function bucketKeyForIso(iso: string, bucket: TrendBucket): string {
  const ms = parseIsoMs(iso);
  if (ms == null) return "";
  const d = new Date(ms);
  if (bucket === "day") {
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  }
  const day = d.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysSinceMonday));
  return `${monday.getUTCFullYear()}-${pad2(monday.getUTCMonth() + 1)}-${pad2(monday.getUTCDate())}`;
}

function isStatusChangeEvent(event: ShowcaseMatrixEventDto): boolean {
  const oldS = event.oldStatus?.trim() ?? null;
  const newS = event.newStatus?.trim() ?? null;
  return oldS !== newS;
}

function isInstallEvent(event: ShowcaseMatrixEventDto): boolean {
  return event.newStatus === "installed" && event.oldStatus !== "installed";
}

export function buildDistributionTrend(
  events: readonly ShowcaseMatrixEventDto[],
  bucket: TrendBucket,
  _now?: Date,
): DistributionTrendPoint[] {
  const changes = events.filter(isStatusChangeEvent);
  if (changes.length === 0) return [];

  const byBucket = new Map<string, { installEvents: number; changeEvents: number }>();

  for (const event of changes) {
    const key = bucketKeyForIso(event.changedAt, bucket);
    if (!key) continue;
    let row = byBucket.get(key);
    if (!row) {
      row = { installEvents: 0, changeEvents: 0 };
      byBucket.set(key, row);
    }
    row.changeEvents += 1;
    if (isInstallEvent(event)) row.installEvents += 1;
  }

  const keys = Array.from(byBucket.keys()).sort((a, b) => a.localeCompare(b));
  let cumulative = 0;
  const out: DistributionTrendPoint[] = [];

  for (const bucketIso of keys) {
    const row = byBucket.get(bucketIso)!;
    cumulative += row.installEvents;
    out.push({
      bucketIso,
      bucketLabel: bucket === "week" ? formatWeekLabel(bucketIso) : formatDayLabel(bucketIso),
      installEvents: row.installEvents,
      changeEvents: row.changeEvents,
      cumulativeInstalled: cumulative,
    });
  }

  return out;
}
