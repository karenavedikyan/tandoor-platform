/**
 * Vercel / Node: GET|POST /api/actualization/state
 * Self-contained: без импортов client/, server/, shared/.
 *
 * MVP: in-memory Map по userId (демо). На Vercel инстансы и cold start не дают
 * настоящей кросс-девайс персистентности — см. docs/client-base-actualization.md
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const JSON_CT = "application/json; charset=utf-8";
const MAX_BODY_CHARS = 400_000;

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

function resolveStorageMode(): "server_memory" | "not_configured" {
  const v = process.env.TANDOOR_ACTUALIZATION_STORAGE?.trim().toLowerCase();
  if (v === "disabled" || v === "off" || v === "false") return "not_configured";
  return "server_memory";
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
    legalEntityOverridesByDealerId: {},
    dealerCardViewSettingsByUserId: {},
    unloadingOrderByDealerId: {},
    routeOrderByRouteId: {},
  };
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

function buildResponse(
  success: boolean,
  storageMode: "persistent" | "server_memory" | "local_fallback" | "not_configured",
  state: unknown,
  updatedAt: string | null,
  message?: string,
): Record<string, unknown> {
  const o: Record<string, unknown> = { success, storageMode, state, updatedAt };
  if (message) o.message = message;
  return o;
}

export default function handler(req: VercelRequest, res: VercelResponse): void {
  try {
    const mode = resolveStorageMode();
    const userId = getUserId(req);
    if (!userId) {
      sendJson(res, 400, {
        success: false,
        storageMode: mode,
        state: emptyState(),
        updatedAt: null,
        message: "Укажите userId (query) или заголовок X-Tandoor-Demo-User-Id (демо MVP).",
      });
      return;
    }

    if (req.method === "GET") {
      if (mode === "not_configured") {
        sendJson(
          res,
          200,
          buildResponse(
            true,
            "not_configured",
            emptyState(),
            null,
            "Серверное хранение актуализации отключено (TANDOOR_ACTUALIZATION_STORAGE).",
          ),
        );
        return;
      }
      const row = memoryStore.get(userId);
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
          "In-memory MVP: на Vercel данные не гарантированы между инстансами и устройствами.",
        ),
      );
      return;
    }

    if (req.method === "POST") {
      if (mode === "not_configured") {
        sendJson(res, 503, {
          success: false,
          storageMode: "not_configured",
          state: emptyState(),
          updatedAt: null,
          message: "Запись отключена (TANDOOR_ACTUALIZATION_STORAGE).",
        });
        return;
      }
      const raw = readJsonBody(req);
      const rawStr = typeof raw === "string" ? raw : JSON.stringify(raw ?? {});
      if (rawStr.length > MAX_BODY_CHARS) {
        sendJson(res, 413, {
          success: false,
          storageMode: "server_memory",
          state: emptyState(),
          updatedAt: null,
          message: "Слишком большой JSON.",
        });
        return;
      }
      const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
      const incoming = body.state ?? body.patch ?? body;
      const next = coerceState(incoming);
      const now = new Date().toISOString();
      next.updatedAt = now;
      next.updatedBy = userId;
      memoryStore.set(userId, { state: next, updatedAt: now });
      sendJson(
        res,
        200,
        buildResponse(
          true,
          "server_memory",
          next,
          now,
          "In-memory MVP: на Vercel данные не гарантированы между инстансами и устройствами.",
        ),
      );
      return;
    }

    sendJson(res, 405, {
      success: false,
      storageMode: mode,
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
