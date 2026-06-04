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
import { applyTrashProtection, purgeExpiredTrash, type UnTrashDirective } from "../../shared/actualization-trash.js";
import {
  sanitizeStateForNonManagerRole,
  shouldSanitizeStateForRole,
} from "../../shared/admin/manager-only-state-fields.js";

const JSON_CT = "application/json; charset=utf-8";
// Стейт актуализации может достигать ~1.3 МБ у активных пользователей с большой базой.
// Vercel-лимит тела serverless ~4.5 МБ, поэтому 4 000 000 символов безопасно.
const MAX_BODY_CHARS = 4_000_000;

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
    archivedDealersById: {},
    tradePointOverridesById: {},
    manuallyCreatedTradePointsById: {},
    archivedTradePointsById: {},
    archivedLegalEntitiesById: {},
    legalEntityOverridesByDealerId: {},
    dealerCardViewSettingsByUserId: {},
    dealerActualizationContactsById: {},
    dealerActualizationAuditByDealerId: {},
    unloadingOrderByDealerId: {},
    routeOrderByRouteId: {},
    dealerPhotosByDealerId: {},
    tradePointPhotosByTradePointId: {},
    // Корзина — отдельная сущность от архива. Хранится 14 дней, чистится cron'ом.
    trashedDealersById: {},
    trashedTradePointsById: {},
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

export function getBatchUserIds(req: VercelRequest): string[] | null {
  const q = req.query?.userIds;
  const raw = typeof q === "string" ? q : Array.isArray(q) ? q.join(",") : "";
  if (!raw.trim()) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(",")) {
    const s = sanitizeUserId(piece);
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
    if (out.length >= 200) break;
  }
  return out.length > 0 ? out : null;
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

export type SqlFn = (strings: TemplateStringsArray, ...params: unknown[]) => Promise<Record<string, unknown>[]>;

async function createSqlExecutor(connectionString: string): Promise<SqlFn> {
  const { neon } = await import("@neondatabase/serverless");
  const { wrapNeonWithShadow } = await import("../../server/db/neon-client.js");
  return wrapNeonWithShadow(neon(connectionString), "actualization") as SqlFn;
}

/**
 * Промт 49: каноническая роль для RBAC GET /api/actualization/state.
 *
 * В разных слоях (client X-Tandoor-Role, sales-role, UserRole) одна и та же
 * сущность приходит под разными именами. Нормализуем перед использованием.
 *
 * - admin                           → admin
 * - director / sales_director       → director
 * - rop / team_lead                 → rop
 * - manager / sales_manager         → manager
 * - analyst                          → analyst
 * - marketer                         → marketer
 * - "" / null / undefined / прочее  → unknown
 */
export type CanonicalRole =
  | "admin"
  | "director"
  | "rop"
  | "manager"
  | "analyst"
  | "marketer"
  | "unknown";

export function canonicalizeRole(role: string | null | undefined): CanonicalRole {
  const r = (role ?? "").trim().toLowerCase();
  if (!r) return "unknown";
  if (r === "admin") return "admin";
  if (r === "director" || r === "sales_director") return "director";
  if (r === "rop" || r === "team_lead") return "rop";
  if (r === "manager" || r === "sales_manager") return "manager";
  if (r === "analyst") return "analyst";
  if (r === "marketer") return "marketer";
  return "unknown";
}

/**
 * Промт 49: возвращает список userId, чьи scope-keys видны при чтении состояния.
 *
 * Главный фикс: `manager` БОЛЬШЕ НЕ попадает в team-ветку. Менеджер видит ровно
 * свой scope. РОП (rop / team_lead) видит scope всех участников своей команды.
 * Директор/админ/аналитик/маркетолог — все scope.
 *
 * `unknown` (роль не передана) — самый узкий scope: только current user.
 */
export async function fetchTeamScopedUserIds(
  sql: SqlFn,
  currentUserId: string,
  role: string | null,
): Promise<string[]> {
  const canonical = canonicalizeRole(role);

  if (canonical === "admin" || canonical === "director" || canonical === "analyst" || canonical === "marketer") {
    const rows = await sql`
      SELECT DISTINCT scope_key
      FROM client_base_actualization_state
      WHERE scope_key LIKE 'user:%'
    `;
    return rows.map((r) => String(r.scope_key).replace(/^user:/, ""));
  }

  if (canonical === "rop") {
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

  // manager / unknown → строго свой scope. Никакой утечки данных коллег.
  return [currentUserId];
}

export async function resolveVisibleUserScopeKeys(
  sql: SqlFn,
  currentUserId: string,
  role: string | null,
): Promise<string[]> {
  if (!role) return [`user:${currentUserId}`];

  try {
    const userIds = await fetchTeamScopedUserIds(sql, currentUserId, role);
    return userIds.map((id) => `user:${id}`);
  } catch {
    // Если таблиц нет (старые миграции) — возвращаем только свой scope.
    return [`user:${currentUserId}`];
  }
}

export type ActualizationStateBatchPart = {
  userId: string;
  state: Record<string, unknown>;
  updatedAt: string | null;
};

export function sanitizeStateFromDbRow(
  row: { state: unknown; updated_at: unknown; role: unknown } | undefined,
): { state: Record<string, unknown>; updatedAt: string | null } {
  if (!row) {
    return { state: emptyState(), updatedAt: null };
  }
  const rowState = coerceState(row.state);
  const rowRole = canonicalizeRole(typeof row.role === "string" ? row.role : null);
  const safeState = shouldSanitizeStateForRole(rowRole) ? sanitizeStateForNonManagerRole(rowState) : rowState;
  return { state: safeState, updatedAt: rowUpdatedAtIso(row.updated_at) };
}

export async function fetchActualizationBatchParts(
  sql: SqlFn,
  userIds: string[],
): Promise<ActualizationStateBatchPart[]> {
  if (userIds.length === 0) return [];
  const orderedScopes = userIds.map((id) => scopeKeyForUser(id));
  const rows = await sql`
    SELECT scope_key, state, updated_at, role
    FROM client_base_actualization_state
    WHERE scope_key = ANY(${orderedScopes})
  `;
  const rowByScope = new Map<string, { state: unknown; updated_at: unknown; role: unknown }>();
  for (const r of rows) {
    rowByScope.set(String(r.scope_key), {
      state: r.state,
      updated_at: r.updated_at,
      role: r.role,
    });
  }
  return userIds.map((id) => {
    const { state, updatedAt } = sanitizeStateFromDbRow(rowByScope.get(scopeKeyForUser(id)));
    return { userId: id, state, updatedAt };
  });
}

function buildBatchPartsResponse(
  success: boolean,
  storageMode: "persistent" | "server_memory" | "not_configured",
  parts: ActualizationStateBatchPart[],
  message?: string,
  code?: string,
): Record<string, unknown> {
  const o: Record<string, unknown> = { success, storageMode, parts, message: message ?? MSG_PERSISTENT_OK };
  if (code) o.code = code;
  return o;
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

function isPurgeTrashRequest(req: VercelRequest): boolean {
  const url = typeof req.url === "string" ? req.url : "";
  if (url.includes("/cron/purge-trash") || url.includes("purge-trash")) {
    const q = req.query?._route;
    const qv = typeof q === "string" ? q : Array.isArray(q) ? q[0] : "";
    if (typeof qv === "string" && qv.trim() === "purge-trash") return true;
  }
  const q = req.query?._route;
  const qv = typeof q === "string" ? q : Array.isArray(q) ? q[0] : "";
  if (typeof qv === "string" && qv.trim() === "purge-trash") return true;
  const h = req.headers["x-tandoor-api-route"];
  const v = Array.isArray(h) ? h[0] : h;
  return typeof v === "string" && v.trim() === "purge-trash";
}

function isCronAuthorized(req: VercelRequest): boolean {
  // Vercel cron автоматически шлёт заголовок x-vercel-cron: 1.
  const cronH = req.headers["x-vercel-cron"];
  const cronV = Array.isArray(cronH) ? cronH[0] : cronH;
  if (typeof cronV === "string" && cronV.trim() === "1") return true;

  // Если задана env CRON_SECRET — также принимаем Authorization: Bearer <secret>.
  const secret = process.env.CRON_SECRET?.trim();
  if (secret) {
    const auth = req.headers["authorization"];
    const av = Array.isArray(auth) ? auth[0] : auth;
    if (typeof av === "string" && av.trim() === `Bearer ${secret}`) return true;
  }
  return false;
}

async function purgeTrashHandler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Поддерживаем POST и GET — Vercel cron шлёт GET с x-vercel-cron: 1.
  if (req.method !== "POST" && req.method !== "GET") {
    sendJson(res, 405, { success: false, message: "Метод не поддерживается. Используйте POST или GET." });
    return;
  }
  if (!isCronAuthorized(req)) {
    sendJson(res, 401, { success: false, code: "UNAUTHORIZED", message: "Требуется заголовок x-vercel-cron или Bearer CRON_SECRET." });
    return;
  }

  const dbUrl = resolvePostgresUrl();
  const t0 = Date.now();
  if (!dbUrl) {
    sendJson(res, 200, {
      success: true,
      scannedScopes: 0,
      purgedDealers: 0,
      purgedTradePoints: 0,
      durationMs: Date.now() - t0,
      note: "no_db",
    });
    return;
  }

  try {
    const sql = await createSqlExecutor(dbUrl);
    const rows = await sql`
      SELECT scope_key, state, role
      FROM client_base_actualization_state
    `;
    const now = Date.now();
    let scannedScopes = 0;
    let purgedDealers = 0;
    let purgedTradePoints = 0;

    for (const row of rows) {
      scannedScopes += 1;
      const stateRaw = row.state;
      if (!isPlainObject(stateRaw)) continue;
      // Промт 50: trashedDealersById / trashedTradePointsById у не-manager scope
      // быть не должно. Пропускаем строку — нечего чистить.
      const rowRoleForPurge = canonicalizeRole(typeof row.role === "string" ? row.role : null);
      if (shouldSanitizeStateForRole(rowRoleForPurge)) continue;
      const stateCopy: Record<string, unknown> = { ...stateRaw };
      const r = purgeExpiredTrash(stateCopy, now);
      if (r.changed) {
        purgedDealers += r.purgedDealers;
        purgedTradePoints += r.purgedTradePoints;
        const updated = JSON.stringify(stateCopy);
        await sql`
          UPDATE client_base_actualization_state
          SET state = ${updated}::jsonb,
              updated_at = now()
          WHERE scope_key = ${String(row.scope_key)}
        `;
      }
    }

    const durationMs = Date.now() - t0;
    console.warn(
      "[actualization-api] purge-trash scanned=" +
        scannedScopes +
        " purged_dealers=" +
        purgedDealers +
        " purged_tps=" +
        purgedTradePoints +
        " ms=" +
        durationMs,
    );
    sendJson(res, 200, {
      success: true,
      scannedScopes,
      purgedDealers,
      purgedTradePoints,
      durationMs,
    });
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error("[actualization-api] purge-trash error", m.slice(0, 200));
    sendJson(res, 500, {
      success: false,
      code: "PURGE_TRASH_ERROR",
      message: "Ошибка при очистке корзины: " + m.slice(0, 200),
    });
  }
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
  if (isPurgeTrashRequest(req)) {
    await purgeTrashHandler(req, res);
    return;
  }
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
        const batchUserIdsDisabled = getBatchUserIds(req);
        if (batchUserIdsDisabled) {
          sendJson(
            res,
            200,
            buildBatchPartsResponse(
              true,
              "not_configured",
              batchUserIdsDisabled.map((id) => ({ userId: id, state: emptyState(), updatedAt: null })),
              MSG_FEATURE_DISABLED,
            ),
          );
          return;
        }
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
      const batchUserIds = getBatchUserIds(req);
      if (batchUserIds) {
        if (!dbUrl) {
          const parts = batchUserIds.map((id) => {
            const row = memoryStore.get(id);
            return {
              userId: id,
              state: row ? coerceState(row.state) : emptyState(),
              updatedAt: row?.updatedAt ?? null,
            };
          });
          sendJson(
            res,
            200,
            buildBatchPartsResponse(
              true,
              "server_memory",
              parts,
              `${MSG_PERSISTENT_NOT_CONFIGURED} ${MSG_SERVER_MEMORY_FALLBACK}`,
            ),
          );
          return;
        }
        try {
          const sql = await createSqlExecutor(dbUrl);
          const parts = await fetchActualizationBatchParts(sql, batchUserIds);
          sendJson(res, 200, buildBatchPartsResponse(true, "persistent", parts, MSG_PERSISTENT_OK));
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          console.error("[actualization-api] persistent GET batch", m.slice(0, 200));
          sendJson(
            res,
            200,
            buildBatchPartsResponse(
              false,
              "persistent",
              batchUserIds.map((id) => ({ userId: id, state: emptyState(), updatedAt: null })),
              MSG_STORAGE_ERROR,
              "ACTUALIZATION_STORAGE_ERROR",
            ),
          );
        }
        return;
      }

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
          SELECT scope_key, state, updated_at, role
          FROM client_base_actualization_state
          WHERE scope_key = ANY(${orderedScopes})
        `;
        const rowByScope = new Map<string, { state: unknown; updated_at: unknown; role: unknown }>();
        for (const r of rows) {
          rowByScope.set(String(r.scope_key), { state: r.state, updated_at: r.updated_at, role: r.role });
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
          // Промт 50: на читаем строку — если её роль не manager, обнуляем
          // 14 manager-only полей перед попаданием в merge. Это страховка для
          // строк, написанных до SQL-миграции (см. scripts/migrate-2026-05-27-manager-only-state.mjs).
          const rowState = coerceState(row.state);
          const rowRole = canonicalizeRole(typeof row.role === "string" ? row.role : null);
          const safeState = shouldSanitizeStateForRole(rowRole) ? sanitizeStateForNonManagerRole(rowState) : rowState;
          orderedStates.push(safeState);
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

      // Промт 50: 14 manager-only полей не должны попадать в state не-manager scope.
      // Применяем симметрично на записи: для admin/director/rop/analyst/marketer/unknown
      // обнуляем эти поля до того, как они пойдут в INSERT и в applyTrashProtection.
      const canonicalForWrite = canonicalizeRole(role);
      const writeShouldSanitize = shouldSanitizeStateForRole(canonicalForWrite);
      const sanitizedNext = writeShouldSanitize ? sanitizeStateForNonManagerRole(next) : next;
      if (writeShouldSanitize) {
        console.warn(
          "[actualization-api] POST sanitized non-manager state scope=" + scopeKey + " role=" + canonicalForWrite,
        );
      }

      const now = new Date().toISOString();
      sanitizedNext.updatedAt = now;
      sanitizedNext.updatedBy = userId;
      const version =
        typeof sanitizedNext.version === "number" && Number.isFinite(sanitizedNext.version)
          ? Math.floor(sanitizedNext.version)
          : 1;

      // Защита корзины (Промт 45 B1): если ключ trashedDealersById / trashedTradePointsById
      // присутствовал в prev state, но отсутствует в next state — восстанавливаем его,
      // если только клиент явно не указал ключ в body.unTrash.dealers / body.unTrash.tradePoints.
      const unTrashRaw = isPlainObject(body.unTrash) ? body.unTrash : null;
      const unTrash: UnTrashDirective | null = unTrashRaw
        ? {
            dealers: Array.isArray(unTrashRaw.dealers)
              ? unTrashRaw.dealers.filter((x): x is string => typeof x === "string")
              : undefined,
            tradePoints: Array.isArray(unTrashRaw.tradePoints)
              ? unTrashRaw.tradePoints.filter((x): x is string => typeof x === "string")
              : undefined,
          }
        : null;

      if (!dbUrl) {
        const prev = memoryStore.get(userId)?.state;
        const prevState = isPlainObject(prev) ? coerceState(prev) : null;
        const guard = applyTrashProtection(prevState, sanitizedNext, unTrash);
        if (guard.protectedDealers > 0 || guard.protectedTradePoints > 0) {
          console.warn(
            "[actualization-api] POST scope=" +
              scopeKey +
              " trash_protected_dealers=" +
              guard.protectedDealers +
              " trash_protected_tps=" +
              guard.protectedTradePoints,
          );
        }
        memoryStore.set(userId, { state: sanitizedNext, updatedAt: now });
        sendJson(
          res,
          200,
          buildResponse(
            true,
            "server_memory",
            sanitizedNext,
            now,
            `${MSG_PERSISTENT_NOT_CONFIGURED} ${MSG_SERVER_MEMORY_FALLBACK}`,
          ),
        );
        return;
      }

      try {
        const sql = await createSqlExecutor(dbUrl);
        // Защита корзины: читаем prev state перед записью.
        try {
          const prevRows = await sql`
            SELECT state FROM client_base_actualization_state WHERE scope_key = ${scopeKey} LIMIT 1
          `;
          const prevRaw = prevRows[0]?.state;
          const prevState = isPlainObject(prevRaw) ? coerceState(prevRaw) : null;
          const guard = applyTrashProtection(prevState, sanitizedNext, unTrash);
          if (guard.protectedDealers > 0 || guard.protectedTradePoints > 0) {
            console.warn(
              "[actualization-api] POST scope=" +
                scopeKey +
                " trash_protected_dealers=" +
                guard.protectedDealers +
                " trash_protected_tps=" +
                guard.protectedTradePoints,
            );
          }
        } catch (e) {
          // Не валим запись из-за защиты — только логируем.
          const m = e instanceof Error ? e.message : String(e);
          console.warn("[actualization-api] trash protection read failed", m.slice(0, 200));
        }
        const stateJson = JSON.stringify(sanitizedNext);
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
