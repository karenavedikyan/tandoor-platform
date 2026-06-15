/**
 * Права на справочник матриц моделей (сервер, UserRole из users.role).
 * Соответствует клиентскому `canManageShowcaseMatrixCatalog`.
 */

/** Роли с правом редактирования справочника на 1 этапе (явный дефолтный доступ). */
const MANAGE_MATRIX_CATALOG_ROLES = new Set(["admin", "marketer", "analyst", "category_manager"]);

/**
 * Редактирование справочника матриц: admin или роли из разрешённого списка.
 * TODO: персональный grant-флаг из БД (`personalGrant`).
 */
export function canManageShowcaseMatrixCatalogServer(
  role: string,
  _personalGrant?: boolean,
): boolean {
  return MANAGE_MATRIX_CATALOG_ROLES.has(role);
}
