/**
 * Обёртка GET-ответов: LRU + ETag + 304 (Промт 380).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  buildCacheKey,
  getCached,
  isBootstrapCacheDebug,
  isBootstrapCacheEnabled,
  setCached,
} from "./api-lru-cache.js";

export type ServeCachedJsonOptions = {
  cacheKey: string;
  ttlMs: number;
  maxAgeSec: number;
  staleWhileRevalidateSec?: number;
  buildBody: () => Promise<unknown>;
  /** Если false — не кэшировать (например 401). */
  shouldCache?: (body: unknown, status: number) => boolean;
};

function normalizeEtag(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t) return null;
  return t.replace(/^W\//, "").replace(/^"/, "").replace(/"$/, "");
}

function readIfNoneMatch(req: VercelRequest): string | null {
  const raw = req.headers["if-none-match"];
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || typeof v !== "string") return null;
  return normalizeEtag(v);
}

function etagMatches(inm: string | null, etag: string): boolean {
  if (!inm || !etag) return false;
  const norm = normalizeEtag(etag);
  return inm === norm || inm === `"${norm}"`;
}

export async function serveCachedJson(
  req: VercelRequest,
  res: VercelResponse,
  status: number,
  opts: ServeCachedJsonOptions,
): Promise<void> {
  const swr = opts.staleWhileRevalidateSec ?? opts.maxAgeSec * 4;
  const cacheControl = `private, max-age=${opts.maxAgeSec}, stale-while-revalidate=${swr}`;

  const cached = getCached(opts.cacheKey);
  if (cached) {
    res.setHeader("Cache-Control", cacheControl);
    res.setHeader("ETag", `"${cached.etag}"`);
    res.setHeader("X-Cache", "HIT");
    if (isBootstrapCacheDebug()) {
      res.setHeader("X-Cache-Key", opts.cacheKey);
      res.setHeader("X-Cache-Age", String(Math.floor((Date.now() - cached.cachedAt) / 1000)));
    }
    if (etagMatches(readIfNoneMatch(req), cached.etag)) {
      res.status(304).end();
      return;
    }
    res.status(status).json(cached.body);
    return;
  }

  const body = await opts.buildBody();
  const shouldCache = opts.shouldCache?.(body, status) ?? (status >= 200 && status < 300);
  let etag = "";
  if (shouldCache && isBootstrapCacheEnabled()) {
    etag = setCached(opts.cacheKey, body, opts.ttlMs);
  }

  res.setHeader("Cache-Control", cacheControl);
  if (etag) res.setHeader("ETag", `"${etag}"`);
  res.setHeader("X-Cache", "MISS");
  if (isBootstrapCacheDebug()) {
    res.setHeader("X-Cache-Key", opts.cacheKey);
    res.setHeader("X-Cache-Age", "0");
  }

  if (etag && etagMatches(readIfNoneMatch(req), etag)) {
    res.status(304).end();
    return;
  }

  res.status(status).json(body);
}

export function userScopedCacheKey(endpoint: string, userId: string, role: string, queryHash = ""): string {
  return buildCacheKey([endpoint, userId, role, queryHash]);
}

export function globalCacheKey(endpoint: string, queryHash = ""): string {
  return buildCacheKey([endpoint, "global", "", queryHash]);
}
