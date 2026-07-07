export const EXCHANGE_S3_BASE = "https://s3.toopatch.ru/images/IMG/exchange";

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
