/**
 * Per-user LRU TTL cache для GET API (Промт 380).
 */

import { createHash } from "node:crypto";
import { LRUCache } from "lru-cache";

export type CachedEntry = {
  body: unknown;
  etag: string;
  cachedAt: number;
  ttlMs: number;
};

const cache = new LRUCache<string, CachedEntry>({
  max: 5000,
});

export function isBootstrapCacheEnabled(): boolean {
  const v = process.env.BOOTSTRAP_CACHE_ENABLED?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "off") return false;
  return true;
}

export function isBootstrapCacheDebug(): boolean {
  return process.env.BOOTSTRAP_CACHE_DEBUG === "true";
}

export function hashEtag(body: unknown): string {
  const json = JSON.stringify(body);
  const digest = createHash("sha256").update(json).digest("hex").slice(0, 16);
  return `v1-${digest}`;
}

export function getCached(key: string): CachedEntry | null {
  if (!isBootstrapCacheEnabled()) return null;
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > hit.ttlMs) {
    cache.delete(key);
    return null;
  }
  return hit;
}

export function setCached(key: string, body: unknown, ttlMs: number): string {
  const etag = hashEtag(body);
  if (isBootstrapCacheEnabled()) {
    cache.set(key, { body, etag, cachedAt: Date.now(), ttlMs });
  }
  return etag;
}

/** Удаляет все ключи с заданным префиксом. */
export function invalidate(prefix: string): void {
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export function resetApiLruCache(): void {
  cache.clear();
}

export function buildCacheKey(parts: string[]): string {
  return parts.filter(Boolean).join(":");
}
