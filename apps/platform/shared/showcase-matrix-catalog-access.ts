/**
 * Права на справочник матриц моделей (сервер, UserRole из users.role).
 * Соответствует клиентскому `canManageShowcaseMatrixCatalog`.
 */

/** Роли с правом редактирования справочника (этап 2: + sales_director, team_lead). */
const MANAGE_MATRIX_CATALOG_ROLES = new Set([
  "admin",
  "marketer",
  "analyst",
  "category_manager",
  "sales_director",
  "team_lead",
]);

/**
 * Редактирование справочника матриц (этап 2): admin, sales_director, team_lead,
 * marketer, analyst, category_manager.
 * TODO: персональный grant-флаг из БД (`personalGrant`).
 */
export function canManageShowcaseMatrixCatalogServer(
  role: string,
  _personalGrant?: boolean,
): boolean {
  return MANAGE_MATRIX_CATALOG_ROLES.has(role);
}
