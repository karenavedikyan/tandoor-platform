/**
 * Типизированные ошибки OAuth callback Bitrix24.
 * Любой ожидаемый сбой в callback должен мапиться на один из этих кодов.
 */

import { duckIsOAuthCallbackError, OAUTH_CALLBACK_ERROR_CODES as SHARED_OAUTH_CODES } from "../shared/bitrix24-oauth-callback-guard";

export type OAuthCallbackErrorCode =
  | "BITRIX24_OAUTH_STATE_MISMATCH"
  | "BITRIX24_OAUTH_MISSING_CODE"
  | "BITRIX24_OAUTH_AUTHORIZATION_DENIED"
  | "BITRIX24_OAUTH_TOKEN_ERROR"
  | "BITRIX24_OAUTH_COOKIE_ERROR"
  | "BITRIX24_OAUTH_NETWORK"
  | "BITRIX24_OAUTH_NOT_CONFIGURED"
  | "BITRIX24_OAUTH_CALLBACK_FAILED";

/** Re-export для модулей, которые импортируют коды из этого файла. */
export const OAUTH_CALLBACK_ERROR_CODES: ReadonlySet<string> = SHARED_OAUTH_CODES;

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

/**
 * Распознаёт OAuthCallbackError и при раздельных чанках Vercel (dynamic import),
 * где `instanceof` ломается из‑за дублирования класса в бандле.
 */
export function isOAuthCallbackError(e: unknown): e is OAuthCallbackError {
  return e instanceof OAuthCallbackError || duckIsOAuthCallbackError(e);
}
