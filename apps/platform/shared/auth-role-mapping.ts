/**
 * Мост пилотных ролей продаж (`SalesRole`) → целевые `UserRole` для сидов и миграций.
 * Держите в соответствии с `client/src/lib/sales-control-data.ts`. В UI пока не подключается.
 */

import type { SalesRole } from "../client/src/lib/sales-control-data";
import type { UserRole } from "./auth";

export function salesRoleToUserRole(role: SalesRole): UserRole {
  switch (role) {
    case "sales_director":
      return "director";
    case "team_lead":
      return "rop";
    case "sales_manager":
      return "manager";
    case "marketer":
      return "marketer";
    case "analyst":
      return "analyst";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}
