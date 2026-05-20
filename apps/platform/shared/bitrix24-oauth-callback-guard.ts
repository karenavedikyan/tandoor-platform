/**
 * Vercel-safe guard для OAuth callback errors: без импортов из server/,
 * только данные + duck-type (для api/* и для server после dynamic import).
 */

export type OAuthCallbackLikeError = {
  name: string;
  status: number;
  code: string;
  message: string;
  bitrixCode?: string;
};

export const OAUTH_CALLBACK_ERROR_CODES: ReadonlySet<string> = new Set([
  "BITRIX24_OAUTH_STATE_MISMATCH",
  "BITRIX24_OAUTH_MISSING_CODE",
  "BITRIX24_OAUTH_AUTHORIZATION_DENIED",
  "BITRIX24_OAUTH_TOKEN_ERROR",
  "BITRIX24_OAUTH_COOKIE_ERROR",
  "BITRIX24_OAUTH_NETWORK",
  "BITRIX24_OAUTH_NOT_CONFIGURED",
  "BITRIX24_OAUTH_CALLBACK_FAILED",
]);

/** Duck-type: не использует instanceof (разные копии класса в чанках). */
export function duckIsOAuthCallbackError(e: unknown): e is OAuthCallbackLikeError {
  if (e == null || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  if (o.name !== "OAuthCallbackError") return false;
  if (typeof o.status !== "number") return false;
  if (typeof o.code !== "string" || !OAUTH_CALLBACK_ERROR_CODES.has(o.code)) return false;
  if (typeof o.message !== "string") return false;
  if (o.bitrixCode !== undefined && typeof o.bitrixCode !== "string") return false;
  return true;
}
