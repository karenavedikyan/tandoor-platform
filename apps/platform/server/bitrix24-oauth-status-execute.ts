/**
 * GET /api/bitrix24/oauth/status для Express (Node).
 * Самодостаточный модуль — без импортов из api/.
 */

export type Bitrix24OAuthStatusHttpResult = {
  status: number;
  body: Record<string, unknown>;
};

function strEnv(name: string): string {
  const v = process.env[name];
  if (v == null) return "";
  return String(v).trim();
}

export function runBitrix24OAuthStatus(): Bitrix24OAuthStatusHttpResult {
  const clientId = strEnv("BITRIX24_OAUTH_CLIENT_ID");
  const clientSecret = strEnv("BITRIX24_OAUTH_CLIENT_SECRET");
  const portalDomain = strEnv("BITRIX24_PORTAL_DOMAIN");
  const configured = Boolean(clientId && clientSecret && portalDomain);

  return {
    status: 200,
    body: {
      success: true,
      configured,
      /** MVP: true только после появления серверного хранения access token по пользователю ЛК. */
      connected: false,
    },
  };
}
