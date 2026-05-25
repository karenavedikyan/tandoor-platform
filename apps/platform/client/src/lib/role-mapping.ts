/**
 * Временный мост UserRole (сервер / shared/auth.ts) ↔ SalesRole (пилотный sales-control).
 * TODO(auth-rbac-scope-cd7c / auth-users-admin-cd7c): убрать адаптер, переписать экраны на UserRole.
 */

import type { UserRole } from "@shared/auth";
import type { SalesRole } from "@/lib/sales-control-data";

export function userRoleToSalesRole(role: UserRole): SalesRole {
  switch (role) {
    case "director":
      return "sales_director";
    case "rop":
    case "regional_manager":
      return "team_lead";
    case "manager":
      return "sales_manager";
    case "marketer":
      return "marketer";
    case "analyst":
      return "analyst";
    case "admin":
    default:
      return "sales_director";
  }
}

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
    default:
      return "manager";
  }
}
