/**
 * GET|POST /api/sales-plan-fact/state
 * Организационный документ план-факта (одна строка scope_key = org:default).
 * Postgres при DATABASE_URL / POSTGRES_URL / NEON_DATABASE_URL, иначе server memory.
 *
 * Демо: заголовок X-Tandoor-Demo-User-Id для аудита updatedBy (опционально на GET).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const JSON_CT = "application/json; charset=utf-8";
const MAX_BODY_CHARS = 400_000;
const ORG_SCOPE = "org:default";

const memoryStore = new Map<string, { state: unknown; updatedAt: string }>();

function sendJson(res: VercelResponse, status: number, body: Record<string, unknown>): void {
  res.setHeader("Content-Type", JSON_CT);
  res.status(status).json(body);
}

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

function isGloballyDisabled(): boolean {
  const v = process.env.TANDOOR_SALES_PLAN_FACT_STORAGE?.trim().toLowerCase();
  return v === "disabled" || v === "off" || v === "false";
}

function sanitizeUserId(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || t.length > 96) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(t)) return null;
  return t;
}

function getUserId(req: VercelRequest): string | null {
  const h = req.headers["x-tandoor-demo-user-id"];
  const fromHeader = Array.isArray(h) ? h[0] : h;
  const q = req.query?.userId;
  const fromQuery = typeof q === "string" ? q : Array.isArray(q) ? q[0] : "";
  return sanitizeUserId(fromHeader) ?? sanitizeUserId(fromQuery);
}

function emptyState(): Record<string, unknown> {
  return { version: 1, updatedAt: null, updatedBy: null, lines: [] };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function coerceState(input: unknown): Record<string, unknown> {
  const base = emptyState();
  if (!isPlainObject(input)) return base;
  const merged = { ...base, ...input };
  if (typeof merged.version !== "number" || !Number.isFinite(merged.version)) merged.version = 1;
  if (!Array.isArray(merged.lines)) merged.lines = [];
  return merged;
}

function buildResponse(
  success: boolean,
  storageMode: "persistent" | "server_memory" | "not_configured",
  state: unknown,
  updatedAt: string | null,
  message?: string,
  code?: string,
): Record<string, unknown> {
  const o: Record<string, unknown> = { success, storageMode, state, updatedAt };
  if (message) o.message = message;
  if (code) o.code = code;
  return o;
}

type SqlFn = (strings: TemplateStringsArray, ...params: unknown[]) => Promise<Record<string, unknown>[]>;

async function createSqlExecutor(connectionString: string): Promise<SqlFn> {
  const { neon } = await import("@neondatabase/serverless");
  return neon(connectionString);
}

function rowUpdatedAtIso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const globallyDisabled = isGloballyDisabled();
    const dbUrl = globallyDisabled ? null : resolvePostgresUrl();

    if (globallyDisabled) {
      if (req.method === "GET") {
        sendJson(res, 200, buildResponse(true, "not_configured", emptyState(), null, "Хранение план-факта отключено (TANDOOR_SALES_PLAN_FACT_STORAGE)."));
        return;
      }
      if (req.method === "POST") {
        sendJson(res, 503, {
          success: false,
          storageMode: "not_configured",
          state: emptyState(),
          updatedAt: null,
          message: "Запись отключена (TANDOOR_SALES_PLAN_FACT_STORAGE).",
        });
        return;
      }
      sendJson(res, 405, { success: false, storageMode: "not_configured", state: emptyState(), updatedAt: null, message: "Метод не поддерживается." });
      return;
    }

    if (req.method === "GET") {
      if (!dbUrl) {
        const row = memoryStore.get(ORG_SCOPE);
        const state = row?.state ?? emptyState();
        const updatedAt = row?.updatedAt ?? null;
        sendJson(
          res,
          200,
          buildResponse(
            true,
            "server_memory",
            state,
            updatedAt,
            "Persistent storage не настроен; данные в памяти сервера (демо).",
          ),
        );
        return;
      }
      try {
        const sql = await createSqlExecutor(dbUrl);
        const rows = await sql`
          SELECT state, updated_at
          FROM sales_plan_fact_state
          WHERE scope_key = ${ORG_SCOPE}
          LIMIT 1
        `;
        const first = rows[0];
        if (!first) {
          sendJson(res, 200, buildResponse(true, "persistent", emptyState(), null, "Данные в Postgres."));
          return;
        }
        const st = coerceState(first.state);
        const updatedAt = rowUpdatedAtIso(first.updated_at);
        sendJson(res, 200, buildResponse(true, "persistent", st, updatedAt, "Данные в Postgres."));
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[sales-plan-fact-api] GET", m.slice(0, 200));
        sendJson(
          res,
          200,
          buildResponse(false, "persistent", emptyState(), null, "Ошибка БД (таблица sales_plan_fact_state).", "SALES_PLAN_FACT_STORAGE_ERROR"),
        );
      }
      return;
    }

    if (req.method === "POST") {
      const userId = getUserId(req) ?? "anonymous";
      const raw = readJsonBody(req);
      const rawStr = typeof raw === "string" ? raw : JSON.stringify(raw ?? {});
      if (rawStr.length > MAX_BODY_CHARS) {
        sendJson(res, 413, { success: false, storageMode: dbUrl ? "persistent" : "server_memory", state: emptyState(), updatedAt: null, message: "Слишком большой JSON." });
        return;
      }
      const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
      const incoming = body.state ?? body;
      const next = coerceState(incoming);
      const now = new Date().toISOString();
      next.updatedAt = now;
      next.updatedBy = userId;
      const version = typeof next.version === "number" && Number.isFinite(next.version) ? Math.floor(next.version) : 1;

      if (!dbUrl) {
        memoryStore.set(ORG_SCOPE, { state: next, updatedAt: now });
        sendJson(res, 200, buildResponse(true, "server_memory", next, now, "Сохранено в памяти сервера (демо)."));
        return;
      }

      try {
        const sql = await createSqlExecutor(dbUrl);
        const stateJson = JSON.stringify(next);
        const rows = await sql`
          INSERT INTO sales_plan_fact_state (scope_key, state, version)
          VALUES (${ORG_SCOPE}, ${stateJson}::jsonb, ${version})
          ON CONFLICT (scope_key) DO UPDATE SET
            state = EXCLUDED.state,
            version = EXCLUDED.version,
            updated_at = now()
          RETURNING state, updated_at
        `;
        const first = rows[0];
        const saved = coerceState(first?.state);
        const updatedAt = rowUpdatedAtIso(first?.updated_at) ?? now;
        sendJson(res, 200, buildResponse(true, "persistent", saved, updatedAt, "Сохранено в Postgres."));
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[sales-plan-fact-api] POST", m.slice(0, 200));
        sendJson(
          res,
          200,
          buildResponse(false, "persistent", emptyState(), null, "Ошибка БД при сохранении.", "SALES_PLAN_FACT_STORAGE_ERROR"),
        );
      }
      return;
    }

    sendJson(res, 405, { success: false, storageMode: dbUrl ? "persistent" : "server_memory", state: emptyState(), updatedAt: null, message: "Метод не поддерживается." });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[sales-plan-fact-api]", m.slice(0, 200));
    sendJson(res, 500, { success: false, storageMode: "server_memory", state: emptyState(), updatedAt: null, message: "Внутренняя ошибка." });
  }
}
