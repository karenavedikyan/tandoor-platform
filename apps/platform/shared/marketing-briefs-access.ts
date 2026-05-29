/**
 * Права на маркетинговые брифы (сервер, UserRole из users.role).
 * Соответствует клиентскому canManageMarketingBriefs (director / rop / marketer).
 */

export function canManageMarketingBriefsServer(role: string): boolean {
  return role === "director" || role === "rop" || role === "marketer";
}
