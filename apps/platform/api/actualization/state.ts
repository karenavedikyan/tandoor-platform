/**
 * Vercel / Node: GET|POST /api/actualization/state
 * Self-contained: без импортов client/, server/, shared/.
 *
 * Персистентность: при наличии DATABASE_URL / POSTGRES_URL / NEON_DATABASE_URL
 * состояние хранится в Postgres (Neon) в таблице client_base_actualization_state.
 * Иначе — fallback на in-memory Map (явно помечен как server_memory).
 *
 * Демо-идентификация: userId из заголовка X-Tandoor-Demo-User-Id или query userId.
 * Это не production security — при внедрении реальной auth scope_key должен
 * вычисляться из сессии на сервере.
 *
 * Также обслуживает /api/sales-plan-fact/state через vercel.json rewrite
 * (объединение в одну serverless-функцию ради лимита Hobby 12 функций).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const JSON_CT = "application/json; charset=utf-8";
const MAX_BODY_CHARS = 400_000;

const memoryStore = new Map<string, { state: unknown; updatedAt: string }>();
const salesPlanFactMemoryStore = new Map<string, { state: unknown; updatedAt: string }>();
const SALES_PLAN_FACT_ORG_SCOPE = "org:default";

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

/** Приоритет: DATABASE_URL → POSTGRES_URL → NEON_DATABASE_URL */
function resolvePostgresUrl(): string | null {
  const a = process.env.DATABASE_URL?.trim();
  if (a) return a;
  const b = process.env.POSTGRES_URL?.trim();
  if (b) return b;
  const c = process.env.NEON_DATABASE_URL?.trim();
  if (c) return c;
  return null;
}

function isActualizationGloballyDisabled(): boolean {
  const v = process.env.TANDOOR_ACTUALIZATION_STORAGE?.trim().toLowerCase();
  return v === "disabled" || v === "off" || v === "false";
}

function emptyState(): Record<string, unknown> {
  return {
    version: 1,
    updatedAt: null,
    updatedBy: null,
    dealerOverridesById: {},
    manuallyCreatedDealersById: {},
    tradePointOverridesById: {},
    manuallyCreatedTradePointsById: {},
    archivedTradePointsById: {},
    archivedLegalEntitiesById: {},
    legalEntityOverridesByDealerId: {},
    dealerCardViewSettingsByUserId: {},
    unloadingOrderByDealerId: {},
    routeOrderByRouteId: {},
    dealerPhotosByDealerId: {},
    tradePointPhotosByTradePointId: {},
  };
}

function sanitizeUserId(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || t.length > 96) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(t)) return null;
  return t;
}

function sanitizeRole(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || t.length > 64) return null;
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

function getRole(req: VercelRequest): string | null {
  const h = req.headers["x-tandoor-demo-user-role"];
  const fromHeader = Array.isArray(h) ? h[0] : h;
  const q = req.query?.role;
  const fromQuery = typeof q === "string" ? q : Array.isArray(q) ? q[0] : "";
  return sanitizeRole(fromHeader) ?? sanitizeRole(fromQuery);
}

function scopeKeyForUser(userId: string): string {
  return `user:${userId}`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function coerceState(input: unknown): Record<string, unknown> {
  const base = emptyState();
  if (!isPlainObject(input)) return base;
  const merged = { ...base, ...input };
  if (typeof merged.version !== "number" || !Number.isFinite(merged.version)) merged.version = 1;
  for (const k of Object.keys(base)) {
    if (k === "version" || k === "updatedAt" || k === "updatedBy") continue;
    if (merged[k] != null && typeof merged[k] === "object" && !Array.isArray(merged[k])) continue;
    merged[k] = base[k];
  }
  return merged;
}

function mergeActualizationStates(states: Record<string, unknown>[]): Record<string, unknown> {
  const result = emptyState();
  let maxUpdatedAt: string | null = null;

  for (const state of states) {
    const updatedAt = state.updatedAt;
    if (typeof updatedAt === "string" && (!maxUpdatedAt || updatedAt > maxUpdatedAt)) {
      maxUpdatedAt = updatedAt;
    }
  }

  result.updatedAt = maxUpdatedAt;
  result.updatedBy = typeof states[0]?.updatedBy === "string" ? states[0].updatedBy : null;

  const base = emptyState();
  for (const field of Object.keys(base)) {
    if (field === "version" || field === "updatedAt" || field === "updatedBy") continue;
    const target = result[field];
    if (!isPlainObject(target)) continue;

    for (const state of states) {
      const value = state[field];
      if (!isPlainObject(value)) continue;
      for (const id of Object.keys(value)) {
        if (!(id in target)) {
          target[id] = value[id];
        }
      }
    }
  }

  return result;
}

function buildResponse(
  success: boolean,
  storageMode: "persistent" | "server_memory" | "local_fallback" | "not_configured",
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

const MSG_PERSISTENT_NOT_CONFIGURED =
  "Persistent storage не настроен. Задайте DATABASE_URL, POSTGRES_URL или NEON_DATABASE_URL в Vercel.";
const MSG_SERVER_MEMORY_FALLBACK =
  "Временное серверное хранение (in-memory): на Vercel данные не гарантированы между инстансами и устройствами.";
const MSG_PERSISTENT_OK = "Данные сохраняются в Postgres (Neon).";
const MSG_FEATURE_DISABLED = "Серверное хранение актуализации отключено (TANDOOR_ACTUALIZATION_STORAGE).";
const MSG_STORAGE_ERROR =
  "Ошибка обращения к базе данных. Проверьте подключение и миграцию таблицы client_base_actualization_state.";

type SqlFn = (strings: TemplateStringsArray, ...params: unknown[]) => Promise<Record<string, unknown>[]>;

async function createSqlExecutor(connectionString: string): Promise<SqlFn> {
  const { neon } = await import("@neondatabase/serverless");
  return neon(connectionString);
}

async function fetchTeamScopedUserIds(sql: SqlFn, currentUserId: string, role: string | null): Promise<string[]> {
  if (role === "admin" || role === "sales_director" || role === "marketer" || role === "analyst") {
    const rows = await sql`
      SELECT DISTINCT scope_key
      FROM client_base_actualization_state
      WHERE scope_key LIKE 'user:%'
    `;
    return rows.map((r) => String(r.scope_key).replace(/^user:/, ""));
  }

  if (role === "team_lead" || role === "manager") {
    const rows = await sql`
      SELECT DISTINCT m2.user_id
      FROM user_team_memberships m1
      JOIN user_team_memberships m2 ON m1.team_id = m2.team_id
      WHERE m1.user_id = ${currentUserId}
    `;
    const ids = rows.map((r) => String(r.user_id));
    if (!ids.includes(currentUserId)) ids.push(currentUserId);
    return ids;
  }

  return [currentUserId];
}

async function resolveVisibleUserScopeKeys(sql: SqlFn, currentUserId: string, role: string | null): Promise<string[]> {
  if (!role) return [`user:${currentUserId}`];

  try {
    const userIds = await fetchTeamScopedUserIds(sql, currentUserId, role);
    return userIds.map((id) => `user:${id}`);
  } catch {
    // Если таблиц нет (старые миграции) — возвращаем только свой scope.
    return [`user:${currentUserId}`];
  }
}

function rowUpdatedAtIso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return null;
}

function isSalesPlanFactRequest(req: VercelRequest): boolean {
  const url = typeof req.url === "string" ? req.url : "";
  if (url.includes("/sales-plan-fact/")) return true;
  const q = req.query?._route;
  const qv = typeof q === "string" ? q : Array.isArray(q) ? q[0] : "";
  if (typeof qv === "string" && qv.trim() === "sales-plan-fact") return true;
  const h = req.headers["x-tandoor-api-route"];
  const v = Array.isArray(h) ? h[0] : h;
  return typeof v === "string" && v.trim() === "sales-plan-fact";
}

function isSalesPlanFactGloballyDisabled(): boolean {
  const v = process.env.TANDOOR_SALES_PLAN_FACT_STORAGE?.trim().toLowerCase();
  return v === "disabled" || v === "off" || v === "false";
}

function salesPlanFactEmptyState(): Record<string, unknown> {
  return { version: 1, updatedAt: null, updatedBy: null, lines: [] };
}

function salesPlanFactCoerceState(input: unknown): Record<string, unknown> {
  const base = salesPlanFactEmptyState();
  if (!isPlainObject(input)) return base;
  const merged = { ...base, ...input };
  if (typeof merged.version !== "number" || !Number.isFinite(merged.version)) merged.version = 1;
  if (!Array.isArray(merged.lines)) merged.lines = [];
  return merged;
}

/**
 * Idempotent ensure-table для sales_plan_fact_state.
 * Кэшируется через module-level promise, чтобы DDL не выполнялся повторно
 * в рамках того же serverless-инстанса. При ошибке кэш сбрасывается, чтобы
 * следующий вызов мог попробовать снова.
 */
let salesPlanFactEnsureTablePromise: Promise<void> | null = null;

async function ensureSalesPlanFactTable(sql: SqlFn): Promise<void> {
  if (salesPlanFactEnsureTablePromise) return salesPlanFactEnsureTablePromise;
  salesPlanFactEnsureTablePromise = (async () => {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS sales_plan_fact_state (
          scope_key text PRIMARY KEY,
          state jsonb NOT NULL,
          version int NOT NULL DEFAULT 1,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS idx_sales_plan_fact_updated_at ON sales_plan_fact_state (updated_at)
      `;
    } catch (e) {
      salesPlanFactEnsureTablePromise = null;
      throw e;
    }
  })();
  return salesPlanFactEnsureTablePromise;
}

function salesPlanFactBuildResponse(
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

async function salesPlanFactHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const globallyDisabled = isSalesPlanFactGloballyDisabled();
    const dbUrl = globallyDisabled ? null : resolvePostgresUrl();

    if (globallyDisabled) {
      if (req.method === "GET") {
        sendJson(
          res,
          200,
          salesPlanFactBuildResponse(
            true,
            "not_configured",
            salesPlanFactEmptyState(),
            null,
            "Хранение план-факта отключено (TANDOOR_SALES_PLAN_FACT_STORAGE).",
          ),
        );
        return;
      }
      if (req.method === "POST") {
        sendJson(res, 503, {
          success: false,
          storageMode: "not_configured",
          state: salesPlanFactEmptyState(),
          updatedAt: null,
          message: "Запись отключена (TANDOOR_SALES_PLAN_FACT_STORAGE).",
        });
        return;
      }
      sendJson(res, 405, {
        success: false,
        storageMode: "not_configured",
        state: salesPlanFactEmptyState(),
        updatedAt: null,
        message: "Метод не поддерживается.",
      });
      return;
    }

    if (req.method === "GET") {
      if (!dbUrl) {
        const row = salesPlanFactMemoryStore.get(SALES_PLAN_FACT_ORG_SCOPE);
        const state = row?.state ?? salesPlanFactEmptyState();
        const updatedAt = row?.updatedAt ?? null;
        sendJson(
          res,
          200,
          salesPlanFactBuildResponse(
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
        await ensureSalesPlanFactTable(sql);
        const rows = await sql`
          SELECT state, updated_at
          FROM sales_plan_fact_state
          WHERE scope_key = ${SALES_PLAN_FACT_ORG_SCOPE}
          LIMIT 1
        `;
        const first = rows[0];
        if (!first) {
          sendJson(
            res,
            200,
            salesPlanFactBuildResponse(true, "persistent", salesPlanFactEmptyState(), null, "Данные в Postgres."),
          );
          return;
        }
        const st = salesPlanFactCoerceState(first.state);
        const updatedAt = rowUpdatedAtIso(first.updated_at);
        sendJson(res, 200, salesPlanFactBuildResponse(true, "persistent", st, updatedAt, "Данные в Postgres."));
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[sales-plan-fact-api] GET", m.slice(0, 200));
        sendJson(
          res,
          200,
          salesPlanFactBuildResponse(
            false,
            "persistent",
            salesPlanFactEmptyState(),
            null,
            "Ошибка БД (таблица sales_plan_fact_state).",
            "SALES_PLAN_FACT_STORAGE_ERROR",
          ),
        );
      }
      return;
    }

    if (req.method === "POST") {
      const userId = getUserId(req) ?? "anonymous";
      const raw = readJsonBody(req);
      const rawStr = typeof raw === "string" ? raw : JSON.stringify(raw ?? {});
      if (rawStr.length > MAX_BODY_CHARS) {
        sendJson(res, 413, {
          success: false,
          storageMode: dbUrl ? "persistent" : "server_memory",
          state: salesPlanFactEmptyState(),
          updatedAt: null,
          message: "Слишком большой JSON.",
        });
        return;
      }
      const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
      const incoming = body.state ?? body;
      const next = salesPlanFactCoerceState(incoming);
      const now = new Date().toISOString();
      next.updatedAt = now;
      next.updatedBy = userId;
      const version =
        typeof next.version === "number" && Number.isFinite(next.version) ? Math.floor(next.version) : 1;

      if (!dbUrl) {
        salesPlanFactMemoryStore.set(SALES_PLAN_FACT_ORG_SCOPE, { state: next, updatedAt: now });
        sendJson(
          res,
          200,
          salesPlanFactBuildResponse(true, "server_memory", next, now, "Сохранено в памяти сервера (демо)."),
        );
        return;
      }

      try {
        const sql = await createSqlExecutor(dbUrl);
        await ensureSalesPlanFactTable(sql);
        const stateJson = JSON.stringify(next);
        const rows = await sql`
          INSERT INTO sales_plan_fact_state (scope_key, state, version)
          VALUES (${SALES_PLAN_FACT_ORG_SCOPE}, ${stateJson}::jsonb, ${version})
          ON CONFLICT (scope_key) DO UPDATE SET
            state = EXCLUDED.state,
            version = EXCLUDED.version,
            updated_at = now()
          RETURNING state, updated_at
        `;
        const first = rows[0];
        const saved = salesPlanFactCoerceState(first?.state);
        const updatedAt = rowUpdatedAtIso(first?.updated_at) ?? now;
        sendJson(res, 200, salesPlanFactBuildResponse(true, "persistent", saved, updatedAt, "Сохранено в Postgres."));
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[sales-plan-fact-api] POST", m.slice(0, 200));
        sendJson(
          res,
          200,
          salesPlanFactBuildResponse(
            false,
            "persistent",
            salesPlanFactEmptyState(),
            null,
            "Ошибка БД при сохранении.",
            "SALES_PLAN_FACT_STORAGE_ERROR",
          ),
        );
      }
      return;
    }

    sendJson(res, 405, {
      success: false,
      storageMode: dbUrl ? "persistent" : "server_memory",
      state: salesPlanFactEmptyState(),
      updatedAt: null,
      message: "Метод не поддерживается.",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[sales-plan-fact-api]", m.slice(0, 200));
    sendJson(res, 500, {
      success: false,
      storageMode: "server_memory",
      state: salesPlanFactEmptyState(),
      updatedAt: null,
      message: "Внутренняя ошибка.",
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (isSalesPlanFactRequest(req)) {
    await salesPlanFactHandler(req, res);
    return;
  }
  try {
    const globallyDisabled = isActualizationGloballyDisabled();
    const dbUrl = globallyDisabled ? null : resolvePostgresUrl();
    const userId = getUserId(req);
    if (!userId) {
      sendJson(res, 400, {
        success: false,
        storageMode: dbUrl ? "persistent" : "not_configured",
        state: emptyState(),
        updatedAt: null,
        message: "Укажите userId (query) или заголовок X-Tandoor-Demo-User-Id (демо MVP).",
      });
      return;
    }

    const scopeKey = scopeKeyForUser(userId);
    const role = getRole(req);

    if (globallyDisabled) {
      if (req.method === "GET") {
        sendJson(
          res,
          200,
          buildResponse(true, "not_configured", emptyState(), null, MSG_FEATURE_DISABLED),
        );
        return;
      }
      if (req.method === "POST") {
        sendJson(res, 503, {
          success: false,
          storageMode: "not_configured",
          state: emptyState(),
          updatedAt: null,
          message: "Запись отключена (TANDOOR_ACTUALIZATION_STORAGE).",
        });
        return;
      }
      sendJson(res, 405, {
        success: false,
        storageMode: "not_configured",
        state: emptyState(),
        updatedAt: null,
        message: "Метод не поддерживается. Используйте GET или POST.",
      });
      return;
    }

    if (req.method === "GET") {
      if (!dbUrl) {
        const ownRow = memoryStore.get(userId);
        const orderedStates: Record<string, unknown>[] = [ownRow ? coerceState(ownRow.state) : emptyState()];
        let maxUpdatedAt: string | null = null;
        memoryStore.forEach((row, storedUserId) => {
          if (row.updatedAt && (!maxUpdatedAt || row.updatedAt > maxUpdatedAt)) maxUpdatedAt = row.updatedAt;
          if (storedUserId !== userId) orderedStates.push(coerceState(row.state));
        });
        const state = mergeActualizationStates(orderedStates);
        const updatedAt = ownRow?.updatedAt ?? maxUpdatedAt;
        sendJson(
          res,
          200,
          buildResponse(
            true,
            "server_memory",
            state,
            updatedAt,
            `${MSG_PERSISTENT_NOT_CONFIGURED} ${MSG_SERVER_MEMORY_FALLBACK}`,
          ),
        );
        return;
      }

      try {
        const sql = await createSqlExecutor(dbUrl);
        const visibleScopeKeys = await resolveVisibleUserScopeKeys(sql, userId, role);
        const ownScope = scopeKeyForUser(userId);
        const orderedScopes = [ownScope, ...visibleScopeKeys.filter((k) => k !== ownScope)];
        if (orderedScopes.length === 0) {
          sendJson(
            res,
            200,
            buildResponse(true, "persistent", emptyState(), null, MSG_PERSISTENT_OK),
          );
          return;
        }
        const rows = await sql`
          SELECT scope_key, state, updated_at
          FROM client_base_actualization_state
          WHERE scope_key = ANY(${orderedScopes})
        `;
        const rowByScope = new Map<string, { state: unknown; updated_at: unknown }>();
        for (const r of rows) {
          rowByScope.set(String(r.scope_key), { state: r.state, updated_at: r.updated_at });
        }
        const orderedStates: Record<string, unknown>[] = [];
        let maxUpdatedAt: string | null = null;
        let ownUpdatedAt: string | null = null;
        for (const sk of orderedScopes) {
          const row = rowByScope.get(sk);
          if (!row) {
            if (sk === ownScope) orderedStates.push(emptyState());
            continue;
          }
          orderedStates.push(coerceState(row.state));
          const iso = rowUpdatedAtIso(row.updated_at);
          if (iso) {
            if (!maxUpdatedAt || iso > maxUpdatedAt) maxUpdatedAt = iso;
            if (sk === ownScope) ownUpdatedAt = iso;
          }
        }
        const merged = mergeActualizationStates(orderedStates);
        const userVisibleUpdatedAt = ownUpdatedAt ?? maxUpdatedAt;
        sendJson(res, 200, buildResponse(true, "persistent", merged, userVisibleUpdatedAt, MSG_PERSISTENT_OK));
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[actualization-api] persistent GET", m.slice(0, 200));
        sendJson(
          res,
          200,
          buildResponse(false, "persistent", emptyState(), null, MSG_STORAGE_ERROR, "ACTUALIZATION_STORAGE_ERROR"),
        );
      }
      return;
    }

    if (req.method === "POST") {
      const raw = readJsonBody(req);
      const rawStr = typeof raw === "string" ? raw : JSON.stringify(raw ?? {});
      if (rawStr.length > MAX_BODY_CHARS) {
        sendJson(res, 413, {
          success: false,
          storageMode: dbUrl ? "persistent" : "server_memory",
          state: emptyState(),
          updatedAt: null,
          message: "Слишком большой JSON.",
        });
        return;
      }
      const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
      const bodyUserId = sanitizeUserId(
        typeof body.userId === "string" ? body.userId : Array.isArray(body.userId) ? String(body.userId[0]) : "",
      );
      if (bodyUserId != null && bodyUserId !== userId) {
        sendJson(res, 400, {
          success: false,
          storageMode: dbUrl ? "persistent" : "server_memory",
          state: emptyState(),
          updatedAt: null,
          message: "userId в теле запроса не совпадает с заголовком/query (демо scope).",
        });
        return;
      }
      const incoming = body.state ?? body.patch ?? body;
      const next = coerceState(incoming);
      const now = new Date().toISOString();
      next.updatedAt = now;
      next.updatedBy = userId;
      const version = typeof next.version === "number" && Number.isFinite(next.version) ? Math.floor(next.version) : 1;

      if (!dbUrl) {
        memoryStore.set(userId, { state: next, updatedAt: now });
        sendJson(
          res,
          200,
          buildResponse(
            true,
            "server_memory",
            next,
            now,
            `${MSG_PERSISTENT_NOT_CONFIGURED} ${MSG_SERVER_MEMORY_FALLBACK}`,
          ),
        );
        return;
      }

      try {
        const sql = await createSqlExecutor(dbUrl);
        const stateJson = JSON.stringify(next);
        const rows = await sql`
          INSERT INTO client_base_actualization_state (scope_key, user_id, role, state, version)
          VALUES (${scopeKey}, ${userId}, ${role}, ${stateJson}::jsonb, ${version})
          ON CONFLICT (scope_key) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            role = COALESCE(EXCLUDED.role, client_base_actualization_state.role),
            state = EXCLUDED.state,
            version = EXCLUDED.version,
            updated_at = now()
          RETURNING state, updated_at
        `;
        const first = rows[0];
        const saved = coerceState(first?.state);
        const updatedAt = rowUpdatedAtIso(first?.updated_at) ?? now;
        sendJson(res, 200, buildResponse(true, "persistent", saved, updatedAt, MSG_PERSISTENT_OK));
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        console.error("[actualization-api] persistent POST", m.slice(0, 200));
        sendJson(
          res,
          200,
          buildResponse(false, "persistent", emptyState(), null, MSG_STORAGE_ERROR, "ACTUALIZATION_STORAGE_ERROR"),
        );
      }
      return;
    }

    sendJson(res, 405, {
      success: false,
      storageMode: dbUrl ? "persistent" : "server_memory",
      state: emptyState(),
      updatedAt: null,
      message: "Метод не поддерживается. Используйте GET или POST.",
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[actualization-api] error", m.slice(0, 200));
    sendJson(res, 500, {
      success: false,
      storageMode: "server_memory",
      state: emptyState(),
      updatedAt: null,
      message: "Внутренняя ошибка API актуализации.",
    });
  }
}
