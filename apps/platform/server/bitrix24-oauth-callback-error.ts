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

export function isOAuthCallbackError(e: unknown): e is OAuthCallbackError {
  return e instanceof OAuthCallbackError;
}
