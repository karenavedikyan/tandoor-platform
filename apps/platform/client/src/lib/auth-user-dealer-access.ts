import type { UserRole } from "@shared/auth";
import type { DealerBaseAccessRole } from "@/lib/dealer-base-role-views";

/** Сопоставление платформенной роли с режимом доступа страницы клиентской базы (мок-роли sales-control). */
export function mapUserRoleToDealerBaseAccess(role: UserRole): DealerBaseAccessRole {
  if (
    role === "admin" ||
    role === "director" ||
    role === "analyst" ||
    role === "marketer" ||
    role === "category_manager"
  )
    return "sales_director";
  if (role === "rop") return "team_lead";
  // [prompt-354] RM — личный scope по dealer_overrides.regional_manager_id, без команды
  if (role === "regional_manager") return "sales_manager";
  return "sales_manager";
}
