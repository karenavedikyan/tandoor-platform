/**
 * GET /api/bitrix24/oauth/callback для Express (Node).
 * Самодостаточный модуль — без импортов из api/.
 * Не логирует code/state из запроса.
 */

export type Bitrix24OAuthCallbackHttpResult = {
  status: number;
  body: Record<string, unknown>;
  /** Сброс state-cookie после успешной проверке. */
  clearStateCookie?: string;
};

function firstQuery(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return firstQuery(v[0]);
  if (typeof v === "string") return v;
  return String(v);
}

function readCookie(cookieHeader: string | undefined, name: string): string {
  if (!cookieHeader || !cookieHeader.trim()) return "";
  const parts = cookieHeader.split(";");
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx < 0) continue;
    const k = p.slice(0, idx).trim();
    if (k !== name) continue;
    try {
      return decodeURIComponent(p.slice(idx + 1).trim());
    } catch {
      return p.slice(idx + 1).trim();
    }
  }
  return "";
}

export function runBitrix24OAuthCallback(input: {
  query: Record<string, unknown>;
  cookieHeader: string | undefined;
}): Bitrix24OAuthCallbackHttpResult {
  const stateFromQuery = firstQuery(input.query.state);
  const stateFromCookie = readCookie(input.cookieHeader, "b24_oauth_state");

  if (!stateFromQuery || !stateFromCookie || stateFromQuery !== stateFromCookie) {
    return {
      status: 400,
      body: {
        success: false,
        code: "BITRIX24_OAUTH_STATE_MISMATCH",
        message: "Не удалось подтвердить запрос авторизации. Начните подключение Bitrix24 снова из личного кабинета.",
      },
    };
  }

  const clearStateCookie = ["b24_oauth_state=", "Path=/api/bitrix24/oauth", "HttpOnly", "SameSite=Lax", "Max-Age=0"].join(
    "; ",
  );

  return {
    status: 200,
    body: {
      success: true,
      code: "BITRIX24_OAUTH_TOKEN_STORAGE_PENDING",
      message:
        "Запрос авторизации Bitrix24 получен, но на сервере ещё не настроено безопасное хранение токена для пользователя ЛК. Обратитесь к администратору.",
    },
    clearStateCookie,
  };
}
