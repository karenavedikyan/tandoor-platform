/**
 * HTTP-клиент к PG-прокси на Yandex VM (Neon → Yandex shadow-write).
 */

const PROXY_URL = process.env.PG_PROXY_URL?.trim().replace(/\/$/, "");
const PROXY_TOKEN = process.env.PG_PROXY_TOKEN?.trim();

export interface ProxyQueryResult<T = Record<string, unknown>> {
  ok: true;
  rows: T[];
  rowCount: number;
  fields?: Array<{ name: string; dataTypeID: number }>;
  durationMs: number;
}

export interface ProxyQueryError {
  ok: false;
  error: string;
  code?: string;
  durationMs?: number;
}

export type ProxyResponse<T = Record<string, unknown>> = ProxyQueryResult<T> | ProxyQueryError;

export class PgProxyNotConfiguredError extends Error {
  constructor() {
    super("PG_PROXY_URL or PG_PROXY_TOKEN missing");
  }
}

export function isPgProxyConfigured(): boolean {
  return !!(PROXY_URL && PROXY_TOKEN);
}

/**
 * Низкоуровневый запрос к прокси. Никогда не выбрасывает по сетевым ошибкам —
 * только возвращает ProxyQueryError. Throw только при отсутствующих ENV.
 */
export async function pgProxyQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  opts: { timeoutMs?: number } = {},
): Promise<ProxyResponse<T>> {
  if (!isPgProxyConfigured()) {
    throw new PgProxyNotConfiguredError();
  }
  const timeoutMs = opts.timeoutMs ?? 8000;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${PROXY_URL}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PROXY_TOKEN}`,
      },
      body: JSON.stringify({ sql, params }),
      signal: controller.signal,
    });
    const text = await resp.text();
    let parsed: ProxyResponse<T>;
    try {
      parsed = JSON.parse(text) as ProxyResponse<T>;
    } catch {
      return {
        ok: false,
        error: `non-json-response: ${text.slice(0, 200)}`,
        code: "PARSE_ERROR",
      };
    }
    if (!resp.ok && parsed && (parsed as ProxyQueryError).ok !== false) {
      return { ok: false, error: `http-${resp.status}`, code: "HTTP_ERROR" };
    }
    return parsed;
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    return {
      ok: false,
      error: err?.message || String(e),
      code: err?.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR",
    };
  } finally {
    clearTimeout(t);
  }
}

/** Health-check прокси. true если БД отвечает. */
export async function pgProxyHealth(): Promise<boolean> {
  if (!isPgProxyConfigured()) return false;
  try {
    const resp = await fetch(`${PROXY_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return false;
    const data = (await resp.json()) as { ok?: boolean; pg?: boolean };
    return data?.ok === true && data?.pg === true;
  } catch {
    return false;
  }
}
