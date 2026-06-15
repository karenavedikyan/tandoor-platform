import { describe, expect, it } from "vitest";
import { canInviteRole, roleHasPermission } from "../auth-rbac.js";
import { canManageShowcaseMatrixCatalogServer } from "../showcase-matrix-catalog-access.js";

describe("category_manager role", () => {
  it("has self profile permissions only", () => {
    expect(roleHasPermission("category_manager", "profile.read_self")).toBe(true);
    expect(roleHasPermission("category_manager", "users.list")).toBe(false);
    expect(roleHasPermission("category_manager", "audit.read")).toBe(false);
  });

  it("can manage showcase matrix catalog", () => {
    expect(canManageShowcaseMatrixCatalogServer("category_manager")).toBe(true);
  });

  it("follows invite rules", () => {
    expect(canInviteRole("category_manager", "manager")).toBe(false);
    expect(canInviteRole("admin", "category_manager")).toBe(true);
  });
});
