/**
 * Промт 400: резолв userId для GET/POST /api/actualization/state.
 * Вынесено из state.ts, чтобы unit-тесты не тянули @neondatabase/serverless.
 */
import type { VercelRequest } from "@vercel/node";
import type { PoolLike } from "./admin/admin-auth.js";

function sanitizeUserId(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t || t.length > 96) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(t)) return null;
  return t;
}

export function getExplicitActualizationUserId(req: VercelRequest): string | null {
  const h = req.headers["x-tandoor-demo-user-id"];
  const fromHeader = Array.isArray(h) ? h[0] : h;
  const q = req.query?.userId;
  const fromQuery = typeof q === "string" ? q : Array.isArray(q) ? q[0] : "";
  return sanitizeUserId(fromHeader) ?? sanitizeUserId(fromQuery);
}

export type RequestUserResolution = {
  userId: string | null;
  fromSession: boolean;
  sessionRole: string | null;
};

export type SessionContextResolver = (
  pool: PoolLike,
  headers: Record<string, string | string[] | undefined>,
) => Promise<{
  me: { id: string; role: string; status: string };
  impersonatorUserId: string | null;
} | null>;

type ResolveRequestUserIdDeps = {
  pool?: PoolLike | null;
  resolveSession?: SessionContextResolver;
  getPool?: () => PoolLike | null;
};

export async function resolveRequestUserId(
  req: VercelRequest,
  deps?: ResolveRequestUserIdDeps,
): Promise<RequestUserResolution> {
  const explicit = getExplicitActualizationUserId(req);
  if (explicit) return { userId: explicit, fromSession: false, sessionRole: null };

  let pool = deps?.pool;
  if (pool === undefined) {
    const getPoolFn = deps?.getPool ?? (await import("./admin/admin-auth.js")).getPool;
    pool = getPoolFn();
  }
  if (!pool) return { userId: null, fromSession: false, sessionRole: null };

  const resolveSession =
    deps?.resolveSession ??
    (await import("./dealer-work-plan-handlers.js")).resolveSessionContext;
  try {
    const ctx = await resolveSession(pool, req.headers as Record<string, string | string[] | undefined>);
    if (ctx?.me?.id && ctx.me.status === "active") {
      return { userId: ctx.me.id, fromSession: true, sessionRole: ctx.me.role ?? null };
    }
  } catch {
    /* ignore session errors */
  }
  return { userId: null, fromSession: false, sessionRole: null };
}
