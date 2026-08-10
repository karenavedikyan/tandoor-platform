export const EXCHANGE_S3_BASE = "https://s3.toopatch.ru/images/IMG/exchange";

export function getFtpExchangeBase(): string {
  return (process.env.FTP_EXCHANGE_BASE?.trim() || "/s3/IMG/exchange").replace(/\/+$/, "");
}

/**
 * Root prefix relative to FTP_EXCHANGE_BASE (usually /s3/IMG/exchange).
 * Empty string = default (production layout).
 * Example: "/full_import (test)" → everything reads/writes under /s3/IMG/exchange/full_import (test)/…
 */
export function resolveExchangeRootPrefix(): string {
  const raw = process.env.EXCHANGE_ROOT_PREFIX?.trim() ?? "";
  if (!raw) return "";
  const withLead = raw.startsWith("/") ? raw : `/${raw}`;
  return withLead.replace(/\/+$/, "");
}

/**
 * Compose a path under the current exchange root prefix.
 * Input: subpath relative to exchange root (e.g. "/import_stores/stores1.xml").
 * Output: prefixed path (e.g. "/full_import (test)/import_stores/stores1.xml"),
 * or the input unchanged if prefix is empty.
 */
export function applyExchangeRootPrefix(subpath: string): string {
  const prefix = resolveExchangeRootPrefix();
  if (!prefix) return subpath;
  const clean = subpath.startsWith("/") ? subpath : `/${subpath}`;
  if (clean === prefix || clean.startsWith(`${prefix}/`)) return clean;
  return `${prefix}${clean}`;
}

/**
 * When EXCHANGE_ROOT_PREFIX is set (test mode), catalog1.xml lives at the prefix root.
 * In production, it is under /full_import/catalog1.xml.
 */
export function resolveCatalogFtpSubpath(): string {
  const prefix = resolveExchangeRootPrefix();
  return prefix ? "/catalog1.xml" : "/full_import/catalog1.xml";
}

export function resolveCatalogFtpPath(): string {
  return `${getFtpExchangeBase()}${applyExchangeRootPrefix(resolveCatalogFtpSubpath())}`;
}

/** Map logical exchange path to absolute FTP path (handles paths already under FTP_EXCHANGE_BASE). */
export function resolveExchangeFtpAbsolutePath(rawPath: string): string {
  const base = getFtpExchangeBase();
  if (rawPath.startsWith(base)) {
    const sub = rawPath.slice(base.length) || "/";
    return `${base}${applyExchangeRootPrefix(sub.startsWith("/") ? sub : `/${sub}`)}`;
  }
  return `${base}${applyExchangeRootPrefix(rawPath.startsWith("/") ? rawPath : `/${rawPath}`)}`;
}

/** Encode exchange path for proxy query params (space → %20; brackets escaped for picky proxies). */
export function encodeExchangePathForProxy(path: string): string {
  return encodeURIComponent(path).replace(/\(/g, "%28").replace(/\)/g, "%29");
}

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const RETRY_DELAYS_MS = [0, 500, 1500] as const;
const FETCH_TIMEOUT_MS = 15_000;

export async function fetchWithRetry(
  url: string,
  accept: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  let lastErr: unknown = null;
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const r = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": BROWSER_USER_AGENT,
          Accept: accept,
          ...extraHeaders,
        },
      });
      if (r.status >= 500 && r.status < 600) {
        lastErr = new Error(`Upstream HTTP ${r.status}`);
        continue;
      }
      return r;
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr ?? new Error("fetch failed");
}

export type ExchangeProxyConfig = {
  proxyUrl: string;
  token: string;
};

export function resolveExchangeProxyConfig(): ExchangeProxyConfig | null {
  const proxyUrl = process.env.EXCHANGE_PROXY_URL?.trim()?.replace(/\/$/, "");
  if (!proxyUrl) return null;
  const token =
    process.env.EXCHANGE_PROXY_TOKEN?.trim() || process.env.SYNC_RUNNER_TOKEN?.trim() || "";
  return { proxyUrl, token };
}

export function exchangeProxyAuthHeaders(token: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const BITRIX_ORDERS_SOURCE_FILE = "orders11.xml";

export function getBitrixOrdersFtpPath(): string {
  return `${getFtpExchangeBase()}${applyExchangeRootPrefix("/import_orders/orders11.xml")}`;
}

export function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** Fetch latest Bitrix orders XML via Yandex VM proxy (`/bitrix-orders/latest`). */
export async function fetchBitrixOrdersXml(): Promise<{ xml: string; sourceFile: string }> {
  const proxy = resolveExchangeProxyConfig();
  if (!proxy) {
    throw new Error("EXCHANGE_PROXY_URL не настроен (Yandex VM proxy).");
  }

  const url = `${proxy.proxyUrl}/bitrix-orders/latest`;
  const r = await fetchWithRetry(url, "application/xml, text/xml, */*", exchangeProxyAuthHeaders(proxy.token));
  if (!r.ok) {
    const ct = r.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const json = (await r.json().catch(() => ({}))) as { message?: string };
      throw new Error(json.message ?? `Proxy HTTP ${r.status}`);
    }
    throw new Error(`Proxy HTTP ${r.status}`);
  }

  return {
    xml: stripUtf8Bom(await r.text()),
    sourceFile: BITRIX_ORDERS_SOURCE_FILE,
  };
}
