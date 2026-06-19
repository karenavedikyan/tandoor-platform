/**
 * Промт 435b: shadow-сравнение старой scope-формулы и view effective_scope.
 * НЕ влияет на ответ API. Только пишет diff в server-log.
 */

import type { PoolLike } from "./responsibility-resolver.js";
import type { UserRole } from "./auth.js";
import { fetchEffectiveScopeForUser } from "./effective-scope.js";

export const SHADOW_FLAG_ENV = "READ_FROM_EFFECTIVE_SCOPE_SHADOW";

export function isShadowReadEnabled(): boolean {
  const v = process.env[SHADOW_FLAG_ENV];
  if (!v) return false;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "on";
}

/** release_code (MA-MA085529) → external_key (client-ma-ma085529) для сравнения с view. */
export function legacyReleaseCodesToExternalKeys(codes: Iterable<string>): Set<string> {
  return new Set(Array.from(codes, (code) => `client-${code.toLowerCase()}`));
}

/**
 * Маппинг responsible_role view → набор external_key, ожидаемых для роли пользователя.
 * Возвращает Set<external_key> того, что view считает scope этого пользователя.
 */
export async function loadShadowExternalKeysForUser(
  pool: PoolLike,
  userId: string,
): Promise<Set<string>> {
  const rows = await fetchEffectiveScopeForUser(pool, userId);
  return new Set(rows.map((r) => r.dealerExternalKey).filter(Boolean));
}

/**
 * Сравнить два набора external_key и вернуть diff.
 * - missing_in_shadow: есть в legacy, нет в shadow (риск: shadow не догоняет до полной правды)
 * - extra_in_shadow:   есть в shadow, нет в legacy (риск: shadow видит лишнее)
 */
export type ShadowDiff = {
  legacy_count: number;
  shadow_count: number;
  missing_in_shadow: string[];
  extra_in_shadow: string[];
};

export function diffScopeSets(
  legacy: Iterable<string>,
  shadow: Iterable<string>,
  sampleLimit = 25,
): ShadowDiff {
  const legacySet = new Set(legacy);
  const shadowSet = new Set(shadow);

  const missing: string[] = [];
  const extra: string[] = [];

  for (const k of legacySet) if (!shadowSet.has(k)) missing.push(k);
  for (const k of shadowSet) if (!legacySet.has(k)) extra.push(k);

  return {
    legacy_count: legacySet.size,
    shadow_count: shadowSet.size,
    missing_in_shadow: missing.slice(0, sampleLimit),
    extra_in_shadow: extra.slice(0, sampleLimit),
  };
}

/**
 * Логирует diff в server-log с тегом, по которому потом можно грепнуть.
 * Подавляет ошибки — shadow никогда не должен ломать прод.
 */
export function logShadowDiff(args: {
  endpoint: string;
  userId: string;
  role: UserRole;
  diff: ShadowDiff;
  legacyAllCodesCount?: number;
}): void {
  try {
    const { endpoint, userId, role, diff, legacyAllCodesCount } = args;
    const equal = diff.missing_in_shadow.length === 0 && diff.extra_in_shadow.length === 0;
    console.log(
      JSON.stringify({
        evt: "effective_scope.shadow_diff",
        endpoint,
        userId,
        role,
        equal,
        legacy_count: diff.legacy_count,
        shadow_count: diff.shadow_count,
        legacy_all_codes_count: legacyAllCodesCount,
        missing_sample: diff.missing_in_shadow,
        extra_sample: diff.extra_in_shadow,
        ts: new Date().toISOString(),
      }),
    );
  } catch {
    // никогда не падаем
  }
}

/** Fire-and-forget shadow diff для resolveScopeCodesMeta (не блокирует hot-path). */
export function scheduleScopeCodesMetaShadowDiff(
  pool: PoolLike,
  userId: string,
  role: UserRole,
  allCodes: string[],
): void {
  if (!isShadowReadEnabled()) return;

  void (async () => {
    try {
      const shadowKeysSet = await loadShadowExternalKeysForUser(pool, userId);
      const legacyExternalKeys = legacyReleaseCodesToExternalKeys(allCodes);
      const diff = diffScopeSets(legacyExternalKeys, shadowKeysSet);
      logShadowDiff({
        endpoint: "resolveScopeCodesMeta",
        userId,
        role,
        diff,
        legacyAllCodesCount: allCodes.length,
      });
    } catch (e) {
      console.warn("[shadow] resolveScopeCodesMeta diff failed", {
        userId,
        role,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  })();
}
