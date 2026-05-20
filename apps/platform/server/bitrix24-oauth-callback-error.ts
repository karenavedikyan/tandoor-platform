/**
 * Типизированные ошибки OAuth callback Bitrix24.
 * Любой ожидаемый сбой в callback должен мапиться на один из этих кодов.
 */

export type OAuthCallbackErrorCode =
  | "BITRIX24_OAUTH_STATE_MISMATCH"
  | "BITRIX24_OAUTH_MISSING_CODE"
  | "BITRIX24_OAUTH_AUTHORIZATION_DENIED"
  | "BITRIX24_OAUTH_TOKEN_ERROR"
  | "BITRIX24_OAUTH_COOKIE_ERROR"
  | "BITRIX24_OAUTH_NETWORK"
  | "BITRIX24_OAUTH_NOT_CONFIGURED"
  | "BITRIX24_OAUTH_CALLBACK_FAILED";

/** Все допустимые коды — для duck-type проверки без `instanceof` (разные бандлы Vercel). */
export const OAUTH_CALLBACK_ERROR_CODES: ReadonlySet<string> = new Set<OAuthCallbackErrorCode>([
  "BITRIX24_OAUTH_STATE_MISMATCH",
  "BITRIX24_OAUTH_MISSING_CODE",
  "BITRIX24_OAUTH_AUTHORIZATION_DENIED",
  "BITRIX24_OAUTH_TOKEN_ERROR",
  "BITRIX24_OAUTH_COOKIE_ERROR",
  "BITRIX24_OAUTH_NETWORK",
  "BITRIX24_OAUTH_NOT_CONFIGURED",
  "BITRIX24_OAUTH_CALLBACK_FAILED",
]);

export class OAuthCallbackError extends Error {
  readonly status: number;
  readonly code: OAuthCallbackErrorCode;
  readonly bitrixCode?: string;

  constructor(status: number, code: OAuthCallbackErrorCode, message: string, bitrixCode?: string) {
    super(message);
    this.name = "OAuthCallbackError";
    this.status = status;
    this.code = code;
    this.bitrixCode = bitrixCode;
  }
}

function isOAuthCallbackErrorDuck(e: unknown): e is OAuthCallbackError {
  if (e == null || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  if (o.name !== "OAuthCallbackError") return false;
  if (typeof o.status !== "number") return false;
  if (typeof o.code !== "string" || !OAUTH_CALLBACK_ERROR_CODES.has(o.code)) return false;
  if (typeof o.message !== "string") return false;
  if (o.bitrixCode !== undefined && typeof o.bitrixCode !== "string") return false;
  return true;
}

/**
 * Распознаёт OAuthCallbackError и при раздельных чанках Vercel (dynamic import),
 * где `instanceof` ломается из‑за дублирования класса в бандле.
 */
export function isOAuthCallbackError(e: unknown): e is OAuthCallbackError {
  return e instanceof OAuthCallbackError || isOAuthCallbackErrorDuck(e);
}
