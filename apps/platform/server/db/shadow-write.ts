/**
 * Best-effort дублирование DML в Yandex через PG-прокси (shadow-write).
 */

import { isPgProxyConfigured, pgProxyQuery } from "./pg-proxy-client.js";

export function isShadowWriteEnabled(): boolean {
  return process.env.SHADOW_WRITE_ENABLED !== "0";
}

/**
 * Дублирует SQL-операцию в Yandex через прокси. Best effort —
 * никогда не выбрасывает, даже если прокси упал.
 */
export async function shadowWrite(sql: string, params: unknown[] = [], tag: string): Promise<void> {
  if (!isPgProxyConfigured()) return;
  if (!isShadowWriteEnabled()) return;

  const normalized = sql.trim().toUpperCase();
  if (
    normalized.startsWith("TRUNCATE") ||
    normalized.startsWith("DROP") ||
    normalized.startsWith("ALTER")
  ) {
    console.warn(`[shadow-write:${tag}] refused dangerous SQL: ${normalized.slice(0, 30)}`);
    return;
  }

  const started = Date.now();
  try {
    const result = await pgProxyQuery(sql, params, { timeoutMs: 2500 });
    if (!result.ok) {
      console.warn(
        `[shadow-write:${tag}] failed (${result.code}): ${result.error} | ` +
          `sql=${sql.slice(0, 120)} | duration=${Date.now() - started}ms`,
      );
    } else if (process.env.SHADOW_WRITE_DEBUG === "1") {
      console.log(`[shadow-write:${tag}] ok rowCount=${result.rowCount} duration=${result.durationMs}ms`);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[shadow-write:${tag}] unexpected throw: ${message}`);
  }
}

/** Fire-and-forget shadow-write (не блокирует вызывающий код). */
export function shadowWriteAsync(sql: string, params: unknown[] = [], tag: string): void {
  void shadowWrite(sql, params, tag).catch(() => undefined);
}
