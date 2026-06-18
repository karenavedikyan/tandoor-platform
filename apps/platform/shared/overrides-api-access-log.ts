/**
 * Серверный access-log overrides API в Postgres (Промт 113.2).
 */

import type { VercelResponse } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";
import { shadowWriteAsync } from "../server/db/shadow-write.js";

export type OverridesApiAccessBodySummary = {
  dealer_id?: string;
  tp_id?: string;
  fields_keys?: string[];
  fields_summary?: string;
};

export type OverridesApiAccessCapture = {
  getStatus: () => number;
  getCode: () => string;
  setUnhandledError: () => void;
};

function safeFieldsSummary(fields: unknown): string | undefined {
  if (fields == null) return undefined;
  try {
    const s = JSON.stringify(fields);
    return s.length > 200 ? `${s.slice(0, 200)}…` : s;
  } catch {
    return "[unserializable]";
  }
}

export function buildOverridesApiBodySummary(body: unknown): OverridesApiAccessBodySummary {
  const b = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const fields = b.fields;
  const fieldsObj =
    fields && typeof fields === "object" && !Array.isArray(fields) ? (fields as Record<string, unknown>) : {};
  const summary: OverridesApiAccessBodySummary = {};
  if (typeof b.dealer_id === "string" && b.dealer_id.trim()) summary.dealer_id = b.dealer_id.trim();
  if (typeof b.tp_id === "string" && b.tp_id.trim()) summary.tp_id = b.tp_id.trim();
  if (Object.keys(fieldsObj).length > 0) {
    summary.fields_keys = Object.keys(fieldsObj);
    summary.fields_summary = safeFieldsSummary(fieldsObj);
  } else if (fields !== undefined) {
    summary.fields_summary = safeFieldsSummary(fields);
  }
  return summary;
}

export function wrapResponseForAccessLog(res: VercelResponse): OverridesApiAccessCapture {
  let status = 200;
  let code = "OK";
  const origStatus = res.status.bind(res);
  const origJson = res.json.bind(res);

  res.status = ((s: number) => {
    status = s;
    return origStatus(s);
  }) as typeof res.status;

  res.json = ((body: unknown) => {
    if (body && typeof body === "object") {
      const o = body as Record<string, unknown>;
      if (typeof o.code === "string") code = o.code;
      else if (o.success === true) code = "OK";
      else if (o.success === false) code = typeof o.code === "string" ? o.code : "ERROR";
    }
    return origJson(body);
  }) as typeof res.json;

  return {
    getStatus: () => status,
    getCode: () => code,
    setUnhandledError: () => {
      status = 500;
      code = "INTERNAL_ERROR";
    },
  };
}

export async function logOverridesApiAccess(
  pool: PoolLike,
  entry: {
    route: string;
    method: string;
    actorUserId?: string | null;
    bodySummary?: OverridesApiAccessBodySummary | null;
    responseStatus: number;
    responseCode: string;
    durationMs: number;
  },
): Promise<void> {
  const sql = `INSERT INTO overrides_api_access_log (
         route, method, actor_user_id, body_summary, response_status, response_code, duration_ms
       ) VALUES ($1, $2, $3::uuid, $4::jsonb, $5, $6, $7)`;
  const params = [
    entry.route,
    entry.method,
    entry.actorUserId ?? null,
    entry.bodySummary ? JSON.stringify(entry.bodySummary) : null,
    entry.responseStatus,
    entry.responseCode,
    entry.durationMs,
  ];
  try {
    await pool.query(sql, params);
    shadowWriteAsync(sql, params, "overrides-api-access-log");
  } catch (e) {
    console.error("[overrides-api-access-log] insert failed", e);
  }
}

export async function finalizeOverridesApiAccessLog(
  pool: PoolLike,
  opts: {
    route: string;
    method: string;
    actorUserId?: string | null;
    body?: unknown;
    isWrite: boolean;
    startedAt: number;
  },
  capture: OverridesApiAccessCapture,
): Promise<void> {
  const durationMs = Date.now() - opts.startedAt;
  const responseStatus = capture.getStatus();
  const shouldLog = opts.isWrite || durationMs > 500 || responseStatus >= 400;
  if (!shouldLog) return;
  await logOverridesApiAccess(pool, {
    route: opts.route,
    method: opts.method,
    actorUserId: opts.actorUserId,
    bodySummary: buildOverridesApiBodySummary(opts.body),
    responseStatus,
    responseCode: capture.getCode(),
    durationMs,
  });
}

const WRITE_ACTIONS = new Set([
  "upsert",
  "set-training",
  "trash",
  "untrash",
  "create-manual",
  "request-purge",
  "restore",
  "purge",
  "admin-restore",
  "bulk-move-archive-to-trash",
  "bulk-restore",
  "bulk-request-purge",
]);

export function isOverridesWriteAction(action: string): boolean {
  return WRITE_ACTIONS.has(action);
}

export async function withOverridesApiAccessLog(
  pool: PoolLike,
  opts: {
    route: string;
    method: string;
    actorUserId: string;
    body?: unknown;
    isWrite: boolean;
  },
  res: VercelResponse,
  run: () => Promise<void>,
): Promise<void> {
  const startedAt = Date.now();
  const capture = wrapResponseForAccessLog(res);
  try {
    await run();
  } catch (e) {
    capture.setUnhandledError();
    throw e;
  } finally {
    await finalizeOverridesApiAccessLog(
      pool,
      {
        route: opts.route,
        method: opts.method,
        actorUserId: opts.actorUserId,
        body: opts.body,
        isWrite: opts.isWrite,
        startedAt,
      },
      capture,
    );
  }
}
