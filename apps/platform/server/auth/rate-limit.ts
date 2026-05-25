/**
 * In-memory rate limit только для POST /api/auth/login.
 *
 * Ограничения: счётчик живёт в памяти процесса — не переживает рестарт; на Vercel
 * действует в пределах одного serverless-контейнера. Для распределённого лимита
 * см. TODO: PR `auth-hardening-cd7c` (Redis и т.п.).
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAIL = 10;

type Bucket = { count: number; firstAttemptAt: number };

const store = new Map<string, Bucket>();

function prune(now: number): void {
  for (const k of Array.from(store.keys())) {
    const b = store.get(k);
    if (b && now - b.firstAttemptAt > WINDOW_MS) store.delete(k);
  }
}

function rateLimitKey(ip: string | null, emailLower: string): string {
  return `${ip ?? "unknown"}:${emailLower}`;
}

export function checkLoginRateLimit(input: {
  ip: string | null;
  emailLower: string;
}): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  prune(now);
  const key = rateLimitKey(input.ip, input.emailLower);
  const b = store.get(key);
  if (!b) return { ok: true };
  const elapsed = now - b.firstAttemptAt;
  if (elapsed > WINDOW_MS) {
    store.delete(key);
    return { ok: true };
  }
  if (b.count < MAX_FAIL) return { ok: true };
  const retryAfterMs = WINDOW_MS - elapsed;
  const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return { ok: false, retryAfterSec };
}

/** Вызывать после неудачной попытки входа (валидация прошла, но credentials неверны). */
export function recordLoginFailure(input: { ip: string | null; emailLower: string }): void {
  const now = Date.now();
  prune(now);
  const key = rateLimitKey(input.ip, input.emailLower);
  const prev = store.get(key);
  if (!prev || now - prev.firstAttemptAt > WINDOW_MS) {
    store.set(key, { count: 1, firstAttemptAt: now });
    return;
  }
  prev.count += 1;
}

/** После успешного входа — сброс счётчика для пары ip+email. */
export function clearLoginRateLimit(input: { ip: string | null; emailLower: string }): void {
  store.delete(rateLimitKey(input.ip, input.emailLower));
}
