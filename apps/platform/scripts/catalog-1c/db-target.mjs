import pg from "pg";
import { logLine } from "./util.mjs";

const { Pool } = pg;

/**
 * @param {'neon' | 'yandex'} kind
 */
export function createDbTarget(kind) {
  if (kind === "neon") return new NeonTarget();
  return new YandexProxyTarget();
}

class NeonTarget {
  constructor() {
    const url =
      process.env.DATABASE_URL_UNPOOLED?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      process.env.POSTGRES_URL?.trim() ||
      "";
    if (!url) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required for neon");
    this.pool = new Pool({ connectionString: url, max: 4 });
    this.label = "neon";
  }

  async query(sql, params = []) {
    return this.pool.query(sql, params);
  }

  async transaction(fn) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const r = await fn(client);
      await client.query("COMMIT");
      return r;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

class YandexProxyTarget {
  constructor() {
    const url =
      process.env.PG_PROXY_URL?.trim()?.replace(/\/$/, "") ||
      process.env.YANDEX_PROXY_URL?.trim()?.replace(/\/$/, "") ||
      "";
    const token = process.env.PG_PROXY_TOKEN?.trim() || process.env.YANDEX_PROXY_TOKEN?.trim() || "";
    if (!url || !token) {
      throw new Error("PG_PROXY_URL/PG_PROXY_TOKEN (or YANDEX_PROXY_*) required for yandex");
    }
    this.baseUrl = url.endsWith("/query") ? url.replace(/\/query$/, "") : url;
    this.token = token;
    this.label = "yandex";
  }

  async query(sql, params = []) {
    const endpoint = `${this.baseUrl}/query`;
    const timeoutMs = Number(process.env.PG_PROXY_TIMEOUT_MS ?? 120_000);
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ sql, params }),
        signal: controller.signal,
      });
      const text = await resp.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`yandex proxy non-json: ${text.slice(0, 200)}`);
      }
      if (!json.ok) {
        throw new Error(json.error || `yandex proxy error http=${resp.status}`);
      }
      return { rows: json.rows ?? [], rowCount: json.rowCount ?? json.rows?.length ?? 0 };
    } finally {
      clearTimeout(t);
    }
  }

  async transaction(fn) {
    await this.query("BEGIN");
    try {
      const r = await fn(this);
      await this.query("COMMIT");
      return r;
    } catch (e) {
      try {
        await this.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw e;
    }
  }

  async close() {
    /* noop */
  }
}

/**
 * @param {import('./util.mjs').DbKind | 'both'} target
 */
export async function createDbTargets(target) {
  const kinds =
    target === "both" ? /** @type {const} */ (["neon", "yandex"]) : [/** @type {const} */ (target)];
  const out = [];
  for (const k of kinds) {
    try {
      out.push(createDbTarget(k));
      logLine(`db target ready: ${k}`);
    } catch (e) {
      logLine(`db target skip ${k}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (out.length === 0) throw new Error("No database targets configured");
  return out;
}
