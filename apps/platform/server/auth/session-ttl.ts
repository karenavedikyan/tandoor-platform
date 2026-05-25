/** TTL сессии в секундах (по умолчанию 30 суток). Переопределение: `TANDOOR_SESSION_TTL_DAYS`. */

export function sessionTtlDays(): number {
  const raw = process.env.TANDOOR_SESSION_TTL_DAYS?.trim();
  if (!raw) return 30;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 365) return 30;
  return n;
}

export function sessionTtlSeconds(): number {
  return sessionTtlDays() * 24 * 60 * 60;
}
