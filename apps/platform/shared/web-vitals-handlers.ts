/**
 * Web Vitals ingest + summary (Промт 382).
 */

import type { PoolLike } from "./admin/admin-auth.js";

export const WEB_VITALS_METRIC_NAMES = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;
export type WebVitalsMetricName = (typeof WEB_VITALS_METRIC_NAMES)[number];

export const WEB_VITALS_RATINGS = ["good", "needs-improvement", "poor"] as const;
export type WebVitalsRating = (typeof WEB_VITALS_RATINGS)[number];

export type WebVitalsIngestPayload = {
  name: WebVitalsMetricName;
  value: number;
  rating?: WebVitalsRating | null;
  pathname: string;
  role?: string | null;
  user_hash?: string | null;
  user_agent?: string | null;
  connection?: string | null;
  viewport_width?: number | null;
  timestamp?: number | null;
};

export type PerfSummaryPathRow = {
  pathname: string;
  events: number;
  p75_lcp: number | null;
  p75_inp: number | null;
  rating: WebVitalsRating | "unknown";
};

export type PerfSummaryRoleRow = {
  role: string;
  events: number;
  p75_lcp: number | null;
};

export type PerfSummaryTrendRow = {
  day: string;
  p75_lcp: number | null;
  p75_lcp_mobile: number | null;
  p75_lcp_desktop: number | null;
};

export type PerfSummaryBudgetViolation = {
  pathname: string;
  metric: string;
  value: number;
  budget: number;
  message: string;
};

export type PerfSummaryResponse = {
  range: string;
  overall: {
    p50_lcp: number | null;
    p75_lcp: number | null;
    p95_lcp: number | null;
    p75_inp: number | null;
    p75_cls: number | null;
    events: number;
  };
  by_pathname: PerfSummaryPathRow[];
  by_role: PerfSummaryRoleRow[];
  trend: PerfSummaryTrendRow[];
  budget_violations: PerfSummaryBudgetViolation[];
};

export const PERF_BUDGETS = {
  p75_lcp_ms: 2500,
  p75_inp_ms: 200,
  p75_cls: 0.1,
} as const;

const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;

type RateBucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();

export function isWebVitalsEnabled(): boolean {
  const v = process.env.WEB_VITALS_ENABLED?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "off") return false;
  return true;
}

export function resetWebVitalsRateLimitForTests(): void {
  rateBuckets.clear();
}

export function checkWebVitalsRateLimit(clientKey: string): boolean {
  const key = clientKey.trim() || "unknown";
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) return false;
  bucket.count += 1;
  return true;
}

function isMetricName(name: string): name is WebVitalsMetricName {
  return (WEB_VITALS_METRIC_NAMES as readonly string[]).includes(name);
}

function isRating(rating: string | null | undefined): rating is WebVitalsRating {
  if (!rating) return false;
  return (WEB_VITALS_RATINGS as readonly string[]).includes(rating);
}

export function validateWebVitalsPayload(raw: unknown): { ok: true; data: WebVitalsIngestPayload } | { ok: false; message: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, message: "Ожидается JSON-объект." };
  }
  const body = raw as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim().toUpperCase() : "";
  if (!isMetricName(name)) {
    return { ok: false, message: "Недопустимое имя метрики." };
  }
  const value = typeof body.value === "number" ? body.value : Number(body.value);
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, message: "metric_value должен быть > 0." };
  }
  const pathname = typeof body.pathname === "string" ? body.pathname.trim() : "";
  if (!pathname || pathname.length > 500) {
    return { ok: false, message: "pathname обязателен (до 500 символов)." };
  }
  const ratingRaw = typeof body.rating === "string" ? body.rating.trim() : null;
  const rating = isRating(ratingRaw) ? ratingRaw : null;
  const role = typeof body.role === "string" ? body.role.trim().slice(0, 64) : null;
  const user_hash = typeof body.user_hash === "string" ? body.user_hash.trim().slice(0, 64) : null;
  const user_agent = typeof body.user_agent === "string" ? body.user_agent.trim().slice(0, 512) : null;
  const connection = typeof body.connection === "string" ? body.connection.trim().slice(0, 32) : null;
  const viewport_width =
    typeof body.viewport_width === "number" && Number.isFinite(body.viewport_width)
      ? Math.max(0, Math.floor(body.viewport_width))
      : null;
  return {
    ok: true,
    data: {
      name,
      value,
      rating,
      pathname,
      role,
      user_hash,
      user_agent,
      connection,
      viewport_width,
      timestamp: typeof body.timestamp === "number" ? body.timestamp : null,
    },
  };
}

export function serializeWebVitalsBeaconPayload(input: {
  name: string;
  value: number;
  rating?: string;
  pathname: string;
  role: string;
  user_hash: string;
  user_agent: string;
  connection?: string;
  viewport_width: number;
  timestamp: number;
}): string {
  return JSON.stringify({
    name: input.name,
    value: input.value,
    rating: input.rating,
    pathname: input.pathname,
    role: input.role,
    user_hash: input.user_hash,
    user_agent: input.user_agent,
    connection: input.connection ?? null,
    viewport_width: input.viewport_width,
    timestamp: input.timestamp,
  });
}

export async function insertWebVitalsEvent(pool: PoolLike, payload: WebVitalsIngestPayload): Promise<void> {
  await pool.query(
    `INSERT INTO web_vitals_events (
      metric_name, metric_value, rating, pathname, role, user_hash, user_agent, connection, viewport_width, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE(to_timestamp($10 / 1000.0), now()))`,
    [
      payload.name,
      payload.value,
      payload.rating ?? null,
      payload.pathname,
      payload.role ?? null,
      payload.user_hash ?? null,
      payload.user_agent ?? null,
      payload.connection ?? null,
      payload.viewport_width ?? null,
      payload.timestamp ?? null,
    ],
  );
}

export function parsePerfRangeDays(raw: string | undefined): number {
  const v = (raw ?? "7d").trim().toLowerCase();
  if (v === "1d") return 1;
  if (v === "30d") return 30;
  if (v === "90d") return 90;
  return 7;
}

function lcpRating(p75: number | null): WebVitalsRating | "unknown" {
  if (p75 == null) return "unknown";
  if (p75 <= 2500) return "good";
  if (p75 <= 4000) return "needs-improvement";
  return "poor";
}

function collectBudgetViolations(rows: PerfSummaryPathRow[]): PerfSummaryBudgetViolation[] {
  const out: PerfSummaryBudgetViolation[] = [];
  for (const row of rows) {
    if (row.p75_lcp != null && row.p75_lcp > PERF_BUDGETS.p75_lcp_ms) {
      out.push({
        pathname: row.pathname,
        metric: "LCP",
        value: row.p75_lcp,
        budget: PERF_BUDGETS.p75_lcp_ms,
        message: `Бюджет превышен на ${row.pathname}: LCP p75 = ${Math.round(row.p75_lcp)} мс`,
      });
    }
    if (row.p75_inp != null && row.p75_inp > PERF_BUDGETS.p75_inp_ms) {
      out.push({
        pathname: row.pathname,
        metric: "INP",
        value: row.p75_inp,
        budget: PERF_BUDGETS.p75_inp_ms,
        message: `Бюджет превышен на ${row.pathname}: INP p75 = ${Math.round(row.p75_inp)} мс`,
      });
    }
  }
  return out;
}

type PgRow = Record<string, unknown>;

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function buildPerfSummary(pool: PoolLike, rangeDays: number): Promise<PerfSummaryResponse> {
  const range = `${rangeDays}d`;
  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

  const overallRes = await pool.query(
    `SELECT
      PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY metric_value) FILTER (WHERE metric_name = 'LCP') AS p50_lcp,
      PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY metric_value) FILTER (WHERE metric_name = 'LCP') AS p75_lcp,
      PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY metric_value) FILTER (WHERE metric_name = 'LCP') AS p95_lcp,
      PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY metric_value) FILTER (WHERE metric_name = 'INP') AS p75_inp,
      PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY metric_value) FILTER (WHERE metric_name = 'CLS') AS p75_cls,
      COUNT(*)::int AS events
    FROM web_vitals_events
    WHERE created_at >= $1`,
    [since.toISOString()],
  );
  const overallRow = (overallRes.rows[0] ?? {}) as PgRow;

  const byPathRes = await pool.query(
    `SELECT
      pathname,
      COUNT(*)::int AS events,
      PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY metric_value) FILTER (WHERE metric_name = 'LCP') AS p75_lcp,
      PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY metric_value) FILTER (WHERE metric_name = 'INP') AS p75_inp
    FROM web_vitals_events
    WHERE created_at >= $1
    GROUP BY pathname
    HAVING COUNT(*) FILTER (WHERE metric_name = 'LCP') > 0
    ORDER BY p75_lcp DESC NULLS LAST
    LIMIT 10`,
    [since.toISOString()],
  );

  const byRoleRes = await pool.query(
    `SELECT
      COALESCE(NULLIF(role, ''), 'unknown') AS role,
      COUNT(*)::int AS events,
      PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY metric_value) FILTER (WHERE metric_name = 'LCP') AS p75_lcp
    FROM web_vitals_events
    WHERE created_at >= $1
    GROUP BY 1
    ORDER BY events DESC`,
    [since.toISOString()],
  );

  const trendRes = await pool.query(
    `SELECT
      to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
      PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY metric_value) FILTER (WHERE metric_name = 'LCP') AS p75_lcp,
      PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY metric_value) FILTER (WHERE metric_name = 'LCP' AND COALESCE(viewport_width, 0) < 768) AS p75_lcp_mobile,
      PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY metric_value) FILTER (WHERE metric_name = 'LCP' AND COALESCE(viewport_width, 0) >= 768) AS p75_lcp_desktop
    FROM web_vitals_events
    WHERE created_at >= $1
    GROUP BY 1
    ORDER BY 1`,
    [since.toISOString()],
  );

  const by_pathname: PerfSummaryPathRow[] = byPathRes.rows.map((row: PgRow) => {
    const p75_lcp = num(row.p75_lcp);
    return {
      pathname: String(row.pathname ?? ""),
      events: Number(row.events ?? 0),
      p75_lcp,
      p75_inp: num(row.p75_inp),
      rating: lcpRating(p75_lcp),
    };
  });

  return {
    range,
    overall: {
      p50_lcp: num(overallRow.p50_lcp),
      p75_lcp: num(overallRow.p75_lcp),
      p95_lcp: num(overallRow.p95_lcp),
      p75_inp: num(overallRow.p75_inp),
      p75_cls: num(overallRow.p75_cls),
      events: Number(overallRow.events ?? 0),
    },
    by_pathname,
    by_role: byRoleRes.rows.map((row: PgRow) => ({
      role: String(row.role ?? "unknown"),
      events: Number(row.events ?? 0),
      p75_lcp: num(row.p75_lcp),
    })),
    trend: trendRes.rows.map((row: PgRow) => ({
      day: String(row.day ?? ""),
      p75_lcp: num(row.p75_lcp),
      p75_lcp_mobile: num(row.p75_lcp_mobile),
      p75_lcp_desktop: num(row.p75_lcp_desktop),
    })),
    budget_violations: collectBudgetViolations(by_pathname),
  };
}

export async function cleanupOldWebVitalsEvents(pool: PoolLike, retentionDays = 90): Promise<{ deleted: number }> {
  const res = await pool.query(
    `DELETE FROM web_vitals_events WHERE created_at < now() - ($1::text || ' days')::interval`,
    [String(retentionDays)],
  );
  return { deleted: res.rowCount ?? 0 };
}

export function canAccessPerfSummary(role: string | null | undefined): boolean {
  return role === "admin" || role === "director";
}
