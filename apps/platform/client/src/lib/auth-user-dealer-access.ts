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
  return "sales_manager";
}
