/**
 * Запуск: `npm run test:auth-access` из каталога apps/platform.
 */
import assert from "node:assert/strict";
import type { UserRole } from "@shared/auth";
import { canCreateResetLink } from "../auth-access";

const U = (id: string, role: UserRole) => ({ id, role });

function t(
  actor: { id: string; role: UserRole },
  target: { id: string; role: UserRole },
  expected: boolean,
  label: string,
): void {
  assert.equal(canCreateResetLink(actor, target), expected, label);
}

t(U("a1", "admin"), U("a2", "admin"), false, "admin→admin запрет");
t(U("a1", "admin"), U("d1", "director"), true, "admin→director ок");
t(U("d1", "director"), U("a1", "admin"), false, "director→admin запрет");
t(U("r1", "rop"), U("m1", "manager"), true, "rop→manager ок");
t(U("r1", "rop"), U("rm1", "regional_manager"), true, "rop→regional_manager ок");
t(U("r1", "rop"), U("d2", "director"), false, "rop→director запрет");
t(U("m1", "manager"), U("m2", "manager"), false, "manager→manager запрет");
t(U("d1", "director"), U("d1", "director"), false, "self запрет");

console.log("auth-access reset-link matrix: ok");
