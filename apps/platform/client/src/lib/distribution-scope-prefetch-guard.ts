/** Ключи scope, для которых префетч матрицы уже запущен/завершён (переживает remount). */
const completedScopePrefetchKeys = new Set<string>();

export function __clearDistributionScopePrefetchKeys(): void {
  completedScopePrefetchKeys.clear();
}

export function markScopePrefetchCompleted(scopeKey: string): void {
  if (scopeKey) completedScopePrefetchKeys.add(scopeKey);
}

export function hasScopePrefetchCompleted(scopeKey: string): boolean {
  return scopeKey !== "" && completedScopePrefetchKeys.has(scopeKey);
}
