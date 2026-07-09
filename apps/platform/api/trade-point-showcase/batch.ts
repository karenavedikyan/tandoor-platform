/**
 * POST /api/trade-point-showcase/batch
 * Возвращает параметры витрины ТТ из общей таблицы trade_point_showcase_state.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { resolveRequestUserId } from "../../shared/actualization-request-user.js";
import { sendJson } from "../../shared/admin/admin-auth.js";
import {
  fetchTradePointShowcaseBatch,
  type SqlFn,
} from "../../shared/trade-point-showcase-shared-store.js";

const JSON_CT = "application/json; charset=utf-8";
const MAX_TRADE_POINT_IDS = 2000;

function readJsonBody(req: VercelRequest): unknown {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body) as unknown;
      } catch {
        return undefined;
      }
    }
    return req.body as unknown;
  }
  return undefined;
}

function resolvePostgresUrl(): string | null {
  const a = process.env.DATABASE_URL?.trim();
  if (a) return a;
  const b = process.env.POSTGRES_URL?.trim();
  if (b) return b;
  const c = process.env.NEON_DATABASE_URL?.trim();
  if (c) return c;
  return null;
}

async function createSqlExecutor(connectionString: string): Promise<SqlFn> {
  const { neon } = await import("@neondatabase/serverless");
  const { wrapNeonWithShadow } = await import("../../server/db/neon-client.js");
  return wrapNeonWithShadow(neon(connectionString), "trade-point-showcase-batch") as SqlFn;
}

function parseTradePointIds(body: unknown): string[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [];
  const raw = (body as Record<string, unknown>).tradePointIds;
  if (!Array.isArray(raw)) return [];
  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (!t || t.length > 128) continue;
    ids.push(t);
  }
  return [...new Set(ids)].slice(0, MAX_TRADE_POINT_IDS);
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Content-Type", JSON_CT);
  try {
    if (req.method !== "POST") {
      sendJson(res, 405, { success: false, message: "Метод не поддерживается. Используйте POST." });
      return;
    }

    const { userId } = await resolveRequestUserId(req);
    if (!userId) {
      sendJson(res, 401, { success: false, message: "Не авторизован", records: [] });
      return;
    }

    const tradePointIds = parseTradePointIds(readJsonBody(req));
    const dbUrl = resolvePostgresUrl();
    if (!dbUrl) {
      sendJson(res, 200, { success: true, records: [] });
      return;
    }

    try {
      const sql = await createSqlExecutor(dbUrl);
      const records = await fetchTradePointShowcaseBatch(sql, tradePointIds);
      sendJson(res, 200, {
        success: true,
        records: records.map((rec) => ({
          tradePointId: rec.tradePointId,
          dealerId: rec.dealerId,
          data: rec.data,
          updatedAt: rec.updatedAt,
          updatedBy: rec.updatedBy,
          updatedByName: rec.updatedByName,
        })),
      });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      console.warn("[trade-point-showcase-batch] fetch failed", m.slice(0, 200));
      sendJson(res, 200, { success: true, records: [] });
    }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.warn("[trade-point-showcase-batch] error", m.slice(0, 200));
    sendJson(res, 500, { success: false, message: "Внутренняя ошибка.", records: [] });
  }
}
